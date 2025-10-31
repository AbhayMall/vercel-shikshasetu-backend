const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateAICourse, listMyAICourses, getAICourse } = require('../controllers/ai.controller');

const router = Router();

router.post('/courses/generate', requireAuth, requireRole('student', 'admin'), generateAICourse);
router.get('/courses/my', requireAuth, requireRole('student', 'admin'), listMyAICourses);
router.get('/courses/:id', requireAuth, requireRole('student', 'admin'), getAICourse);

module.exports = router;