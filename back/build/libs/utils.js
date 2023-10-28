import { v4 as uuidv4 } from 'uuid';
const generateRoomId = () => {
    return uuidv4();
};
const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
};
const getRoomStatus = (currentSize, maxSize, isStarted = false) => {
    if (isStarted) {
        return 'In Progress';
    }
    return currentSize === maxSize ? 'Full' : 'Open';
};
const getDrawAndGuessLobbyRoomInfo = (drawAndGuessDetailRoomInfo) => {
    return {
        roomId: drawAndGuessDetailRoomInfo.roomId,
        roomName: drawAndGuessDetailRoomInfo.roomName,
        owner: drawAndGuessDetailRoomInfo.owner,
        status: drawAndGuessDetailRoomInfo.status,
        currentPlayerCount: drawAndGuessDetailRoomInfo.currentPlayerCount,
        maxPlayers: drawAndGuessDetailRoomInfo.maxPlayers,
        rounds: drawAndGuessDetailRoomInfo.rounds,
        password: drawAndGuessDetailRoomInfo.password,
    };
};
const getRandomCategory = (wordBank) => {
    const categoryList = Object.keys(wordBank);
    const randomCategoryIndex = getRandomInt(0, categoryList.length);
    const randomCategory = categoryList[randomCategoryIndex];
    return {
        [randomCategory]: wordBank[randomCategory],
    };
};
const getRandomChoicesFromList = (wordList, numberOfChoices) => {
    const selectedIndexes = new Set();
    while (selectedIndexes.size < numberOfChoices) {
        selectedIndexes.add(getRandomInt(0, wordList.length));
    }
    return [...selectedIndexes].map((index) => wordList[index]);
};
const getRandomElementFromSet = (set) => {
    const randomIndex = getRandomInt(0, set.size);
    const iterator = set.values();
    let result = iterator.next();
    for (let i = 0; i < randomIndex; i++) {
        result = iterator.next();
    }
    return result.value;
};
const convertStrToUnderscores = (str) => {
    return str.replace(/\S/g, '_');
};
const resetPoints = (playerList) => {
    return Object.fromEntries(Object.entries(playerList).map(([socketId, playerInfo]) => {
        return [
            socketId,
            Object.assign(Object.assign({}, playerInfo), { points: 0 }),
        ];
    }));
};
const resetReceivedPointsThisTurn = (playerList) => {
    return Object.fromEntries(Object.entries(playerList).map(([socketId, playerInfo]) => {
        return [
            socketId,
            Object.assign(Object.assign({}, playerInfo), { receivedPointsThisTurn: false }),
        ];
    }));
};
export { generateRoomId, getRandomInt, getRoomStatus, getDrawAndGuessLobbyRoomInfo, getRandomCategory, getRandomChoicesFromList, getRandomElementFromSet, convertStrToUnderscores, resetPoints, resetReceivedPointsThisTurn, };
