import { useEffect } from "react";
import { config } from "../../config";
import "./Header.css";

interface HeaderProps {
  /** Titre affiché dans la bannière */
  title?: string;
  /** URL de l'image du logo */
  logoUrl?: string;
  /** Activer les logs console (par défaut uniquement en dev) */
  debug?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  title = "Clearspace DXTR",
  logoUrl = "/logo192.png", // l'image placée dans public/
  debug = config.debug || config.environment === "development",
}) => {
  const dlog = (...args: any[]) => {
    if (debug) console.log(...args);
  };

  useEffect(() => {
    dlog(`[Header] Rendu - ${title}`);
  }, [title]);

  return (
    <header className="header" role="banner" aria-label={`Bannière ${title}`}>
      <img
        src={logoUrl}
        alt="Logo Clearspace DXTR"
        className="header__logo"
        aria-hidden="false"
        loading="lazy"
      />
      <h1 className="header__title">{title}</h1>
    </header>
  );
};

export default Header;
