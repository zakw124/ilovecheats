import { MessageCircle, Send, Video } from "lucide-react";
import type { MouseEvent } from "react";

const currentYear = new Date().getFullYear();
const discordInviteUrl = "https://discord.gg/ilovecheats";

function ignoreClick(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
}

export function Footer() {
  return (
    <footer className="footer-section" id="support">
      <div className="footer-inner">
        <div className="footer-brand">
          <a className="footer-brand-mark" href="/">
            <img className="footer-logo" src="/images/brand-icon.png" alt="" />
            <strong>ilovecheats.com</strong>
          </a>
          <p>Undetected game cheats, instant delivery, and human support around the clock.</p>
        </div>

        <nav className="footer-links" aria-label="Footer navigation">
          <span>Explore</span>
          <a href="/">Home</a>
          <a href="/store">Store</a>
          <a href="/status">Status</a>
          <a href={discordInviteUrl} target="_blank" rel="noreferrer">
            Discord
          </a>
        </nav>

        <div className="footer-meta">
          <div className="footer-social" aria-label="Social links">
            <a href={discordInviteUrl} aria-label="Discord" target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" />
            </a>
            <a href="#" aria-label="Video" onClick={ignoreClick}>
              <Video aria-hidden="true" />
            </a>
            <a href="#" aria-label="Telegram" onClick={ignoreClick}>
              <Send aria-hidden="true" />
            </a>
          </div>
          <span>{currentYear} Copyright © ILC limited. All rights reserved</span>
          <span>Web development done by @eacinjector</span>
        </div>
      </div>
    </footer>
  );
}
