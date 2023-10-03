import express, { Request, Response } from 'express';
import { wordBank, generateRoomId, getRandomInt } from '..//libs/index.js';

const router = express.Router();
