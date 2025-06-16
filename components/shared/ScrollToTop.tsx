
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const mainContentArea = document.getElementById('main-content-area');
    if (mainContentArea) {
      // Using requestAnimationFrame to ensure scroll happens after potential layout shifts
      requestAnimationFrame(() => {
        mainContentArea.scrollTo(0, 0);
      });
    }
  }, [pathname]);

  return null;
};

export default ScrollToTop;
