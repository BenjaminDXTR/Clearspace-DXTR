import { useEffect } from "react";
import { config } from "../../config";
import "./Header.css";

interface HeaderProps {
  /** Titre affiché dans la bannière */
  title?: string;
  /** Icône à afficher à gauche du titre (emoji ou image) */
  icon?: React.ReactNode;
  /** Activer les logs console (par défaut uniquement en dev) */
  debug?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  title = "DroneWeb",
  icon = "🚁",
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
      <span
        className="header__icon"
        aria-hidden={typeof icon === "string"} // cache si emoji simple
      >
        {icon}
      </span>
      <h1 className="header__title">{title}</h1>
    </header>
  );
};

export default Header;
