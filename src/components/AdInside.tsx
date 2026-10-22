import { useEffect, useRef } from 'react';
import { beginAdRedirectGuard, endAdRedirectGuard, blockExternalRedirect } from '../services/antiFakeAds';

export default function AdInside({ adScript }: { adScript: string }) {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Block external navigation ONLY while this ad container is on screen (scoped guard)
    blockExternalRedirect();
    beginAdRedirectGuard();

    if (ref.current) {
      ref.current.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-forms');
      // IMPORTANT: NO allow-top-navigation, NO allow-popups
      iframe.style.width = '100%';
      iframe.style.height = '400px';
      iframe.style.border = '0';
      iframe.srcdoc = `
        <html><body style="margin:0">
        <script>
          window.open = () => null;
          window.top = window.self;
        </script>
        ${adScript}
        </body></html>
      `;
      ref.current.appendChild(iframe);
    }
    
    // Remove all _blank
    const obs = new MutationObserver(() => {
      document.querySelectorAll('a[target="_blank"]').forEach((a: any) => {
        a.setAttribute('target','_self');
        a.addEventListener('click', (e: any) => {
          e.preventDefault();
          e.stopPropagation();
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    
    return () => { obs.disconnect(); endAdRedirectGuard(); };
  }, [adScript]);
  
  return <div ref={ref} style={{width:'100%', minHeight:'400px'}} />;
}
