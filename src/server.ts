import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { runDetectionLoop } from './detector.js';

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

setInterval(runDetectionLoop,10000);

app.get('/opportunities', async (_, res) => {
  const ops = await prisma.opportunity.findMany({
    orderBy: { timestamp: 'desc' },
    take: 20
  });
  res.json(ops);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
