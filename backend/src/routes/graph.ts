import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getKnowledgeGraph } from '../controllers/graphController';

const router = Router();

router.use(authenticate);
router.get('/', getKnowledgeGraph);

export default router;
