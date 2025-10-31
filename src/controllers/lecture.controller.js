const { Lecture } = require('../models/Lecture');
const { Course } = require('../models/Course');
const axios = require('axios');
const { uploadVideoToCloudinary } = require('../config/cloudinary');

function sanitizeFilename(name = 'video') {
  return String(name)
    .replace(/[\x00-\x1f\x80-\x9f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'video';
}

function buildCloudinaryCandidates(originalUrl) {
  try {
    if (!originalUrl || !originalUrl.includes('res.cloudinary.com') || !originalUrl.includes('/upload/')) {
      return [];
    }
    const [prefix, rest] = originalUrl.split('/upload/');
    const t = (tr) => `${prefix}/upload/${tr}/${rest}`;
    // Prefer fast Cloudinary h264 transform used earlier for great speed/size
    return [
      t('f_mp4,vc_h264,q_auto:good,br_1200k'),
      t('f_mp4,vc_h264,q_auto:good'),
      t('f_mp4,vc_h264,q_auto'),
    ];
  } catch (_) {
    return [];
  }
}

async function listByCourse(req, res) {
  const { courseId } = req.params;
  const lectures = await Lecture.find({ course: courseId }).sort({ createdAt: 1 });
  return res.json({ lectures });
}

async function create(req, res) {
  try {
    const { courseId } = req.params;
    const { title, description, durationSec } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    
    let videoUrl = req.body.videoUrl; // fallback for direct URL
    
    // Handle file upload if present
    if (req.file) {
      const result = await uploadVideoToCloudinary(req.file.buffer);
      videoUrl = result.secure_url;
    }
    
    if (!videoUrl) return res.status(400).json({ error: 'Video URL or file required' });
    
    const lecture = await Lecture.create({ course: courseId, title, description, videoUrl, durationSec });
    return res.status(201).json({ lecture });
  } catch (err) {
    return res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
}

async function downloadCompressed(req, res) {
  try {
    const { courseId, lectureId } = req.params;
    const lecture = await Lecture.findById(lectureId);
    if (!lecture || lecture.course.toString() !== courseId) {
      return res.status(404).json({ error: 'Lecture not found' });
    }

    // NOTE: Route-level role check already ensures only authorized roles can access.
    const filename = `${sanitizeFilename(lecture.title)}.mp4`;

    // Cloudinary transform (fast, good compression)
    let streamResp = null;
    const candidates = buildCloudinaryCandidates(lecture.videoUrl);
    for (const url of candidates) {
      try {
        streamResp = await axios({ method: 'GET', url, responseType: 'stream', timeout: 45000 });
        break;
      } catch (_) {}
    }

    // Fallback: original video
    if (!streamResp) {
      streamResp = await axios({ method: 'GET', url: lecture.videoUrl, responseType: 'stream', timeout: 45000 });
    }

    res.set({
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    });
    streamResp.data.pipe(res);
  } catch (err) {
    console.error('Download error:', err.message);
    res.status(500).json({ error: 'Failed to prepare download' });
  }
}

module.exports = { listByCourse, create, downloadCompressed }; 

