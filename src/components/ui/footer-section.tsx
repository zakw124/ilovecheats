import { MessageCircle, Send, Video } from "lucide-react";

const currentYear = new Date().getFullYear();

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
            <a href="/#discord" aria-label="Discord">
              <MessageCircle aria-hidden="true" />
            </a>
            <a href="#" aria-label="Video">
              <Video aria-hidden="true" />
            </a>
            <a href="#" aria-label="Telegram">
              <Send aria-hidden="true" />
            </a>
          </div>
          <span>{currentYear} Copyright ©</span>
        </div>
      </div>
    </footer>
  );
}
