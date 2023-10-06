import { v4 as uuidv4 } from 'uuid';

function generateRoomId(): string {
    return uuidv4();
}

function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

export { generateRoomId, getRandomInt };
