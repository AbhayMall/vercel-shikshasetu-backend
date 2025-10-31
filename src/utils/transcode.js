const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

function transcodeToMp4({ input, res, filename, crf = 23, audioBitrateK = 96, preset = 'slow', codec = 'libx264', extraOptions = [] }) {
  return new Promise((resolve, reject) => {
    // Prepare headers early (we are returning a file)
    res.set({
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    });

    const command = ffmpeg(input)
      .videoCodec(codec)
      .audioCodec('aac')
      .audioBitrate(`${audioBitrateK}k`)
      .outputOptions([
        `-preset ${preset}`,
        `-crf ${crf}`,
        '-movflags frag_keyframe+empty_moov',
        '-pix_fmt yuv420p',
        ...extraOptions,
      ])
      .format('mp4')
      .on('error', (err) => {
        reject(err);
      })
      .on('end', () => {
        resolve();
      });

    command.pipe(res, { end: true });
  });
}

async function transcodeBestQualitySmall({ input, res, filename }) {
  // Try HEVC first (best size/quality), then H.264 as fallback.
  try {
    await transcodeToMp4({
      input,
      res,
      filename,
      crf: 20,
      audioBitrateK: 96,
      preset: 'veryslow',
      codec: 'libx265',
      extraOptions: [
        // Improve quality retention with HEVC
        '-x265-params profile=main:aq-mode=3:aq-strength=1.0:psy-rd=2.0:psy-rdoq=1.0'
      ]
    });
    return;
  } catch (_) {
    // fall through to x264
  }

  await transcodeToMp4({
    input,
    res,
    filename,
    crf: 18,
    audioBitrateK: 96,
    preset: 'veryslow',
    codec: 'libx264',
    extraOptions: [
      '-tune film'
    ]
  });
}

module.exports = { transcodeToMp4, transcodeBestQualitySmall };
