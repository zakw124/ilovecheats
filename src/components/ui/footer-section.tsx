import { MessageCircle, Send, Video } from "lucide-react";

const currentYear = new Date().getFullYear();
const discordInviteUrl = "https://discord.gg/ilovecheats";

export function Footer() {
  return (
    <footer className="footer-section" id="support">
      <div className="footer-inner">
        <a className="footer-brand" href="/">
          <strong>ilovecheats.com</strong>
          <img className="footer-logo" src="/images/brand-icon.png" alt="" />
        </a>

        <div className="footer-social">
          <div aria-label="Social links">
            <a href={discordInviteUrl} aria-label="Discord" target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" />
            </a>
            <a href="#" aria-label="Video">
              <Video aria-hidden="true" />
            </a>
            <a href="#" aria-label="Telegram">
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
