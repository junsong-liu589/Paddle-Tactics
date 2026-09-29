import { useNavigation } from "./lib/navigation.js";
import { HomePage } from "./pages/HomePage.js";
import { MatchPage } from "./pages/MatchPage.js";
import { PlayPage } from "./pages/PlayPage.js";
import { ResultPage } from "./pages/ResultPage.js";
import { SetupPage } from "./pages/SetupPage.js";

export default function App() {
  const { path, navigate } = useNavigation();
  const matchRoute = path.match(/^\/match\/([^/]+)$/);
  const resultRoute = path.match(/^\/result\/([^/]+)$/);

  return (
    <>
      <header className="site-header">
        <button
          className="brand-mark"
          onClick={() => navigate("/")}
          aria-label="乒乓战术首页"
        >
          <span className="brand-icon">
            <i />
          </span>
          <span>
            乒乓战术<small>TABLE TENNIS TACTICS</small>
          </span>
        </button>
        <nav aria-label="主导航">
          <button onClick={() => navigate("/play")}>开始对局</button>
          <span className="header-status">
            <i /> 本地沙盒
          </span>
        </nav>
      </header>
      {matchRoute ? (
        <MatchPage
          key={matchRoute[1]}
          matchId={decodeURIComponent(matchRoute[1]!)}
          navigate={navigate}
        />
      ) : resultRoute ? (
        <ResultPage
          key={resultRoute[1]}
          matchId={decodeURIComponent(resultRoute[1]!)}
          navigate={navigate}
        />
      ) : path === "/play" ? (
        <PlayPage navigate={navigate} />
      ) : path === "/setup" ? (
        <SetupPage navigate={navigate} />
      ) : (
        <HomePage navigate={navigate} />
      )}
    </>
  );
}
