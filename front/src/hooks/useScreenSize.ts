import { useState, useEffect } from 'react';

const useScreenSize = () => {
    const [screenSize, setScreenSize] = useState({
        currentScreenWidth: window.innerWidth,
        currentScreenHeight: window.innerHeight,
    });

    useEffect(() => {
        const handleResize = () => {
            setScreenSize({
                currentScreenWidth: window.innerWidth,
                currentScreenHeight: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);

        // Cleanup the event listener on unmount
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return screenSize;
};

export default useScreenSize;
