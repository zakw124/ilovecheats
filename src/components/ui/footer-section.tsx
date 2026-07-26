import { MessageCircle } from "lucide-react";

const currentYear = new Date().getFullYear();
const discordInviteUrl = "https://discord.gg/ilovecheats";

export function Footer() {
  return (
    <footer className="footer-section" id="support">
      <div className="footer-inner">
        <div className="footer-top">
          <a className="footer-brand-mark" href="/">
            <img className="footer-logo" src="/images/brand-icon.png" alt="" />
            <strong>ilovecheats.com</strong>
          </a>

          <nav className="footer-links" aria-label="Footer navigation">
            <a href="/">Home</a>
            <a href="/store">Store</a>
            <a href="/status">Status</a>
            <a href={discordInviteUrl} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" />
              Discord
            </a>
          </nav>
        </div>

        <div className="footer-bottom">
          <span>{currentYear} Copyright © ILC limited. All rights reserved</span>
          <span>Web development done by @eacinjector</span>
        </div>
      </div>
    </footer>
  );
}
