//! Lõi Rust của fxcine: lưu dự án trên đĩa, gọi ffmpeg / say / whisper-cli,
//! và nhận frame từ engine (WebView) để mã hóa MP4.

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{Manager, State};

type CmdResult<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

// ───────── Thư mục dữ liệu ─────────

fn root(app: &tauri::AppHandle) -> CmdResult<PathBuf> {
    let dir = app.path().document_dir().map_err(err)?.join("fxcine");
    std::fs::create_dir_all(&dir).map_err(err)?;
    Ok(dir)
}

/// Chỉ cho phép đường dẫn tương đối, không "..", không tuyệt đối.
fn safe_join(base: &Path, rel: &str) -> CmdResult<PathBuf> {
    let p = Path::new(rel);
    if p.is_absolute() || p.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err(format!("đường dẫn không hợp lệ: {rel}"));
    }
    Ok(base.join(p))
}

fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
}

#[tauri::command]
fn data_root(app: tauri::AppHandle) -> CmdResult<String> {
    Ok(root(&app)?.to_string_lossy().into_owned())
}

#[tauri::command]
fn fs_read_text(app: tauri::AppHandle, rel: String) -> CmdResult<Option<String>> {
    let p = safe_join(&root(&app)?, &rel)?;
    if !p.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(p).map(Some).map_err(err)
}

#[tauri::command]
fn fs_write_text(app: tauri::AppHandle, rel: String, text: String) -> CmdResult<()> {
    let p = safe_join(&root(&app)?, &rel)?;
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).map_err(err)?;
    }
    // ghi tạm rồi đổi tên để không hỏng file khi app tắt giữa chừng
    let tmp = p.with_extension("tmp");
    std::fs::write(&tmp, text).map_err(err)?;
    std::fs::rename(tmp, p).map_err(err)
}

#[tauri::command]
fn fs_read_bytes(app: tauri::AppHandle, rel: String) -> CmdResult<Response> {
    let p = safe_join(&root(&app)?, &rel)?;
    let bytes = std::fs::read(p).map_err(err)?;
    Ok(Response::new(bytes))
}

/// Ghi bytes: thân request là dữ liệu thô, đường dẫn nằm trong header `x-rel`.
#[tauri::command]
fn fs_write_bytes(app: tauri::AppHandle, request: Request<'_>) -> CmdResult<()> {
    let rel = request
        .headers()
        .get("x-rel")
        .and_then(|v| v.to_str().ok())
        .ok_or("thiếu header x-rel")?
        .to_string();
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("cần dữ liệu nhị phân".into());
    };
    let p = safe_join(&root(&app)?, &rel)?;
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).map_err(err)?;
    }
    std::fs::write(p, bytes).map_err(err)
}

#[tauri::command]
fn fs_list(app: tauri::AppHandle, rel: String) -> CmdResult<Vec<String>> {
    let p = safe_join(&root(&app)?, &rel)?;
    if !p.exists() {
        return Ok(vec![]);
    }
    let mut out = vec![];
    for e in std::fs::read_dir(p).map_err(err)? {
        let e = e.map_err(err)?;
        out.push(e.file_name().to_string_lossy().into_owned());
    }
    out.sort();
    Ok(out)
}

#[tauri::command]
fn fs_remove(app: tauri::AppHandle, rel: String) -> CmdResult<()> {
    let p = safe_join(&root(&app)?, &rel)?;
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(err)
    } else if p.exists() {
        std::fs::remove_file(p).map_err(err)
    } else {
        Ok(())
    }
}

// ───────── Công cụ ngoài ─────────

/// App GUI trên macOS không có PATH của shell → tự dò các vị trí phổ biến.
fn find_tool(name: &str, custom: &str) -> Option<PathBuf> {
    if !custom.is_empty() && Path::new(custom).exists() {
        return Some(PathBuf::from(custom));
    }
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect())
        .unwrap_or_default();
    for d in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/opt/local/bin"] {
        dirs.push(PathBuf::from(d));
    }
    dirs.into_iter().map(|d| d.join(name)).find(|p| p.exists())
}

#[derive(Serialize)]
struct Capabilities {
    ffmpeg: Option<String>,
    say: bool,
    whisper: Option<String>,
    root: String,
}

#[tauri::command]
fn capabilities(app: tauri::AppHandle, ffmpeg: String, whisper: String) -> CmdResult<Capabilities> {
    Ok(Capabilities {
        ffmpeg: find_tool("ffmpeg", &ffmpeg).map(|p| p.to_string_lossy().into_owned()),
        say: Path::new("/usr/bin/say").exists(),
        whisper: find_tool("whisper-cli", &whisper).map(|p| p.to_string_lossy().into_owned()),
        root: root(&app)?.to_string_lossy().into_owned(),
    })
}

fn ffmpeg_bin(custom: &str) -> CmdResult<PathBuf> {
    find_tool("ffmpeg", custom).ok_or_else(|| "Không tìm thấy ffmpeg (brew install ffmpeg)".to_string())
}

fn exec(cmd: &mut Command) -> CmdResult<std::process::Output> {
    let out = cmd.output().map_err(err)?;
    if !out.status.success() {
        let msg = String::from_utf8_lossy(&out.stderr);
        let tail: String = msg.lines().rev().take(6).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n");
        return Err(tail);
    }
    Ok(out)
}

fn probe_duration(ffmpeg: &Path, file: &Path) -> f64 {
    // ffmpeg -i in -f null - in ra "time=..." ở stderr; ffprobe nằm cạnh ffmpeg
    let ffprobe = ffmpeg.with_file_name("ffprobe");
    if let Ok(out) = Command::new(ffprobe)
        .args(["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1"])
        .arg(file)
        .output()
    {
        if let Ok(v) = String::from_utf8_lossy(&out.stdout).trim().parse::<f64>() {
            return v;
        }
    }
    0.0
}

#[derive(Serialize)]
struct MediaInfo {
    file: String,
    duration: f64,
}

/// Chuyển file âm thanh bất kỳ → WAV 48kHz mono trong thư mục media của dự án.
#[tauri::command]
fn import_audio(app: tauri::AppHandle, project: String, src: String, prefix: String, ffmpeg: String) -> CmdResult<MediaInfo> {
    let bin = ffmpeg_bin(&ffmpeg)?;
    let dir = safe_join(&root(&app)?, &format!("projects/{project}/media"))?;
    std::fs::create_dir_all(&dir).map_err(err)?;
    let name = format!("{prefix}-{}.wav", now_ms());
    let out = dir.join(&name);
    exec(Command::new(&bin).args(["-v", "error", "-y", "-i"]).arg(&src).args(["-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le"]).arg(&out))?;
    Ok(MediaInfo { duration: probe_duration(&bin, &out), file: name })
}

/// Giọng đọc offline bằng `say` của macOS.
#[tauri::command]
fn say_tts(app: tauri::AppHandle, project: String, text: String, voice: String, rate: u32, ffmpeg: String) -> CmdResult<MediaInfo> {
    let tmp = std::env::temp_dir().join(format!("fxcine-say-{}.aiff", now_ms()));
    let mut cmd = Command::new("/usr/bin/say");
    if !voice.is_empty() {
        cmd.args(["-v", &voice]);
    }
    cmd.args(["-r", &rate.to_string(), "-o"]).arg(&tmp).arg(&text);
    exec(&mut cmd)?;
    let info = import_audio(app, project, tmp.to_string_lossy().into_owned(), "say".into(), ffmpeg);
    let _ = std::fs::remove_file(tmp);
    info
}

#[tauri::command]
fn list_say_voices() -> CmdResult<Vec<String>> {
    let out = exec(Command::new("/usr/bin/say").args(["-v", "?"]))?;
    Ok(String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter(|l| l.contains("en_") || l.contains("vi_"))
        .filter_map(|l| l.split("  ").next().map(|s| s.trim().to_string()))
        .collect())
}

/// Nhận dạng giọng nói bằng whisper.cpp → JSON có timestamp từng token.
#[tauri::command]
fn whisper(app: tauri::AppHandle, project: String, media: String, cli: String, model: String, ffmpeg: String) -> CmdResult<String> {
    let bin = find_tool("whisper-cli", &cli).ok_or("Không tìm thấy whisper-cli (brew install whisper-cpp)")?;
    if model.is_empty() || !Path::new(&model).exists() {
        return Err("Chưa chọn file model whisper (.bin) trong Cài đặt".into());
    }
    let src = safe_join(&root(&app)?, &format!("projects/{project}/media/{media}"))?;
    let tmp = std::env::temp_dir().join(format!("fxcine-asr-{}", now_ms()));
    let wav = tmp.with_extension("wav");
    exec(Command::new(ffmpeg_bin(&ffmpeg)?).args(["-v", "error", "-y", "-i"]).arg(&src).args(["-ac", "1", "-ar", "16000"]).arg(&wav))?;
    exec(Command::new(bin).args(["-m", &model, "-f"]).arg(&wav).args(["-ojf", "-of"]).arg(&tmp))?;
    let json = std::fs::read_to_string(tmp.with_extension("json")).map_err(err)?;
    let _ = std::fs::remove_file(wav);
    let _ = std::fs::remove_file(tmp.with_extension("json"));
    Ok(json)
}

/// Đường dẫn file kết quả nếu app được mở ở chế độ tự kiểm tra (FXCINE_SELFTEST=/đường/dẫn.mp4)
#[tauri::command]
fn selftest_target() -> Option<String> {
    std::env::var("FXCINE_SELFTEST").ok().filter(|s| !s.is_empty())
}

#[tauri::command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn reveal(path: String) -> CmdResult<()> {
    Command::new("open").args(["-R", &path]).spawn().map_err(err)?;
    Ok(())
}

// ───────── Xuất video ─────────

struct ExportJob {
    child: Child,
    stdin: Option<ChildStdin>,
    out: PathBuf,
    frame_bytes: usize,
    frames: u64,
}

#[derive(Default)]
struct ExportState(Mutex<Option<ExportJob>>);

#[derive(Deserialize)]
struct ExportParams {
    project: String,
    width: u32,
    height: u32,
    fps: u32,
    duration: f64,
    out: String,
    voice: Option<String>,
    sfx: Option<String>,
    music: Option<String>,
    music_volume: f32,
    ffmpeg: String,
    crf: u32,
}

/// Dựng tham số ffmpeg (hàm thuần để test được).
fn ffmpeg_args(p: &ExportParams, media: &Path) -> CmdResult<Vec<std::ffi::OsString>> {
    use std::ffi::OsString;
    let mut a: Vec<OsString> = vec![];
    let mut push = |v: &str| a.push(OsString::from(v));
    for v in ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s"] {
        push(v);
    }
    push(&format!("{}x{}", p.width, p.height));
    push("-r");
    push(&p.fps.to_string());
    push("-i");
    push("pipe:0");
    let mut idx = 1;
    let mut voice_i = None;
    let mut sfx_i = None;
    let mut music_i = None;
    for (slot, file) in [(&mut voice_i, &p.voice), (&mut sfx_i, &p.sfx)] {
        if let Some(f) = file {
            a.push("-i".into());
            a.push(safe_join(media, f)?.into_os_string());
            *slot = Some(idx);
            idx += 1;
        }
    }
    if let Some(f) = &p.music {
        for v in ["-stream_loop", "-1", "-i"] {
            a.push(v.into());
        }
        a.push(safe_join(media, f)?.into_os_string());
        music_i = Some(idx);
    }
    // Đồ thị âm thanh: voice + sfx + nhạc nền tự giảm khi có giọng (sidechain)
    let fmt = "aformat=sample_rates=48000:channel_layouts=stereo";
    let mut graph = vec![];
    let mut mix = vec![];
    if let Some(v) = voice_i {
        if music_i.is_some() {
            graph.push(format!("[{v}:a]{fmt},asplit=2[voice][vkey]"));
        } else {
            graph.push(format!("[{v}:a]{fmt}[voice]"));
        }
        mix.push("[voice]".to_string());
    }
    if let Some(s) = sfx_i {
        graph.push(format!("[{s}:a]{fmt}[sfx]"));
        mix.push("[sfx]".to_string());
    }
    if let Some(m) = music_i {
        graph.push(format!("[{m}:a]{fmt},volume={:.3}[music]", p.music_volume));
        if voice_i.is_some() {
            graph.push("[music][vkey]sidechaincompress=threshold=0.04:ratio=8:attack=30:release=500[mduck]".into());
            mix.push("[mduck]".to_string());
        } else {
            mix.push("[music]".to_string());
        }
    }
    if !mix.is_empty() {
        graph.push(format!("{}amix=inputs={}:normalize=0:duration=longest,alimiter=limit=0.95[aout]", mix.join(""), mix.len()));
        for v in ["-filter_complex", &graph.join(";"), "-map", "0:v", "-map", "[aout]", "-c:a", "aac", "-b:a", "192k"] {
            a.push(v.into());
        }
    }
    for v in ["-c:v", "libx264", "-preset", "medium", "-crf", &p.crf.to_string(), "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", &format!("{:.3}", p.duration)] {
        a.push(v.into());
    }
    a.push(OsString::from(&p.out));
    Ok(a)
}

#[tauri::command]
fn export_begin(app: tauri::AppHandle, state: State<'_, ExportState>, p: ExportParams) -> CmdResult<()> {
    let mut guard = state.0.lock().map_err(err)?;
    if let Some(mut old) = guard.take() {
        let _ = old.child.kill();
    }
    let bin = ffmpeg_bin(&p.ffmpeg)?;
    let media = safe_join(&root(&app)?, &format!("projects/{}/media", p.project))?;
    let args = ffmpeg_args(&p, &media)?;
    let mut child = Command::new(bin)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(err)?;
    let stdin = child.stdin.take();
    *guard = Some(ExportJob {
        child,
        stdin,
        out: PathBuf::from(&p.out),
        frame_bytes: (p.width * p.height * 4) as usize,
        frames: 0,
    });
    Ok(())
}

/// Nhận một frame RGBA thô (thân request nhị phân).
#[tauri::command]
fn export_frame(state: State<'_, ExportState>, request: Request<'_>) -> CmdResult<u64> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("frame phải là dữ liệu nhị phân".into());
    };
    let mut guard = state.0.lock().map_err(err)?;
    let job = guard.as_mut().ok_or("chưa bắt đầu xuất")?;
    if bytes.len() % job.frame_bytes != 0 {
        return Err(format!("kích thước frame sai: {} (cần bội số của {})", bytes.len(), job.frame_bytes));
    }
    let stdin = job.stdin.as_mut().ok_or("ffmpeg đã đóng")?;
    if let Err(e) = stdin.write_all(bytes) {
        // ffmpeg chết giữa chừng → đọc lỗi để báo
        let mut stderr = String::new();
        if let Some(mut s) = job.child.stderr.take() {
            use std::io::Read;
            let _ = s.read_to_string(&mut stderr);
        }
        return Err(format!("{e}: {stderr}"));
    }
    job.frames += (bytes.len() / job.frame_bytes) as u64;
    Ok(job.frames)
}

#[tauri::command]
fn export_end(state: State<'_, ExportState>) -> CmdResult<String> {
    let mut job = state.0.lock().map_err(err)?.take().ok_or("chưa bắt đầu xuất")?;
    drop(job.stdin.take());
    let out = job.child.wait_with_output().map_err(err)?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).into_owned());
    }
    Ok(job.out.to_string_lossy().into_owned())
}

#[tauri::command]
fn export_cancel(state: State<'_, ExportState>) -> CmdResult<()> {
    if let Some(mut job) = state.0.lock().map_err(err)?.take() {
        let _ = job.child.kill();
        let _ = std::fs::remove_file(&job.out);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ExportState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            data_root,
            fs_read_text,
            fs_write_text,
            fs_read_bytes,
            fs_write_bytes,
            fs_list,
            fs_remove,
            capabilities,
            import_audio,
            say_tts,
            list_say_voices,
            whisper,
            reveal,
            selftest_target,
            quit,
            export_begin,
            export_frame,
            export_end,
            export_cancel
        ])
        .run(tauri::generate_context!())
        .expect("error while running fxcine");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_join_blocks_escape() {
        let base = Path::new("/tmp/base");
        assert!(safe_join(base, "projects/a/project.json").is_ok());
        assert!(safe_join(base, "../etc/passwd").is_err());
        assert!(safe_join(base, "/etc/passwd").is_err());
        assert!(safe_join(base, "a/../../b").is_err());
    }

    /// Xuất thật bằng ffmpeg: frame thô qua stdin + voice + sfx + nhạc (sidechain).
    #[test]
    fn export_pipeline_produces_mp4_with_audio() {
        let Some(ff) = find_tool("ffmpeg", "") else {
            eprintln!("bỏ qua: không có ffmpeg");
            return;
        };
        let dir = std::env::temp_dir().join(format!("fxcine-test-{}", now_ms()));
        std::fs::create_dir_all(&dir).unwrap();
        for (name, src) in [("voice.wav", "sine=f=220:d=1.2"), ("sfx.wav", "sine=f=880:d=0.3"), ("music.wav", "sine=f=330:d=0.5")] {
            exec(Command::new(&ff).args(["-v", "error", "-y", "-f", "lavfi", "-i", src]).arg(dir.join(name))).unwrap();
        }
        let out = dir.join("out.mp4");
        let p = ExportParams {
            project: "x".into(),
            width: 72,
            height: 128,
            fps: 30,
            duration: 1.0,
            out: out.to_string_lossy().into_owned(),
            voice: Some("voice.wav".into()),
            sfx: Some("sfx.wav".into()),
            music: Some("music.wav".into()),
            music_volume: 0.3,
            ffmpeg: String::new(),
            crf: 23,
        };
        let mut child = Command::new(&ff).args(ffmpeg_args(&p, &dir).unwrap()).stdin(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
        {
            let stdin = child.stdin.as_mut().unwrap();
            for f in 0..30u8 {
                let frame: Vec<u8> = (0..72 * 128).flat_map(|_| [f * 8, 120, 255 - f * 8, 255]).collect();
                stdin.write_all(&frame).unwrap();
            }
        }
        let res = child.wait_with_output().unwrap();
        assert!(res.status.success(), "{}", String::from_utf8_lossy(&res.stderr));
        let probe = Command::new(ff.with_file_name("ffprobe"))
            .args(["-v", "error", "-show_entries", "stream=codec_type,codec_name:format=duration", "-of", "compact"])
            .arg(&out)
            .output()
            .unwrap();
        let info = String::from_utf8_lossy(&probe.stdout);
        assert!(info.contains("codec_name=h264"), "{info}");
        assert!(info.contains("codec_type=audio"), "{info}");
        let dur = probe_duration(&ff, &out);
        assert!((dur - 1.0).abs() < 0.1, "duration {dur}");
        let _ = std::fs::remove_dir_all(dir);
    }
}
