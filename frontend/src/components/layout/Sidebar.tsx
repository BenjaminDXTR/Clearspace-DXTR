import { useEffect, ReactNode } from "react";
import { config } from "../../config";
import "./Sidebar.css";

interface SidebarProps {
  /** Contenu de la sidebar */
  children?: ReactNode;
  /** Active/désactive les logs console */
  debug?: boolean;
  /** Titre affiché au-dessus du contenu */
  title?: string;
}

export default function Sidebar({
  children,
  debug = config.debug || config.environment === "development",
  title,
}: SidebarProps) {
  const dlog = (...args: any[]): void => {
    if (debug) console.log(...args);
  };

  useEffect(() => {
    dlog(`[Sidebar] affichée ${children ? "(avec contenu)" : "(vide)"}`);
  }, [children]);

  return (
    <aside
      className="sidebar"
      role="complementary"
      aria-labelledby={title ? "sidebarTitle" : undefined}
      aria-label={!title ? "Barre latérale" : undefined}
    >
      {title && (
        <h2 id="sidebarTitle" className="sidebar__title">
          {title}
        </h2>
      )}

      {children ? (
        children
      ) : (
        <div className="sidebar__placeholder">
          Aucun contenu à afficher pour le moment.
        </div>
      )}
    </aside>
  );
}
