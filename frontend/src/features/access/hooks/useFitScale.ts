import { useEffect, useState } from 'react';
import { fitScale } from '../utils/fit-scale';

const currentScale = () => fitScale(window.innerWidth, window.innerHeight);

/** The scale that fits the kiosk stage in the window; it follows the window when it is resized. */
export function useFitScale(): number {
  const [scale, setScale] = useState(currentScale);
  useEffect(() => {
    const update = () => setScale(currentScale());
    window.addEventListener('resize', update);
    update();
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}
