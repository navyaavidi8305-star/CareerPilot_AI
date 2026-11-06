import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getLearningProgress,
  getLearningSubject,
  getLearningSubjects,
  getLearningVideos,
  updateLearningPreferences,
  updateLearningProgress,
} from '../controllers/learningController';

const router = Router();

router.use(authenticate);

router.get('/subjects', getLearningSubjects);
router.get('/subjects/:key', getLearningSubject);
router.get('/videos', getLearningVideos);
router.get('/progress', getLearningProgress);
router.put('/preferences', updateLearningPreferences);
router.post('/progress', updateLearningProgress);

export default router;
