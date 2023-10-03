function generateRoomId(): string {
    let id = '';
    let possibleChars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 6; i++) {
        id += possibleChars.charAt(
            Math.floor(Math.random() * possibleChars.length),
        );
    }

    return id;
}

function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

export { generateRoomId, getRandomInt };
