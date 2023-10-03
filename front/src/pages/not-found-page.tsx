import '../styles/pages/not-found-page.css';

export default function NotFound() {
    return (
        <div className="not-found-layout">
            <div className="not-found-emoji">😢</div>
            <h1 className="not-found-text">
                The page you are looking for does not exist.
            </h1>
        </div>
    );
}
