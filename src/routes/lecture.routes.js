const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { listByCourse, create, downloadCompressed } = require('../controllers/lecture.controller');
const { upload } = require('../config/cloudinary');

const router = Router({ mergeParams: true });

router.get('/', listByCourse);
router.post('/', requireAuth, requireRole('instructor', 'admin'), upload.single('video'), create);

// Download compressed video for a lecture
router.get('/:lectureId/download', requireAuth, requireRole('student', 'instructor', 'admin'), downloadCompressed);

module.exports = router;

