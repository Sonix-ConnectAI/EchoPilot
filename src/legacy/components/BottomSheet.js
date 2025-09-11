import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../styles/BottomSheet.css';

const BottomSheet = ({ 
  isOpen, 
  onClose, 
  children, 
  title = "Bottom Sheet",
  container: containerProp,
  height: heightProp,
  footerActionbar,
  categoryFilters,
  onCategoryFilterChange,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [containerEl, setContainerEl] = useState(null);
  const [heightPx, setHeightPx] = useState(null);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightPxRef = useRef(0);
  const contentRef = useRef(null);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    // Resolve container: prop > .edit-panel > document.body
    let target = null;
    if (containerProp instanceof HTMLElement) {
      target = containerProp;
    } else if (typeof containerProp === 'string') {
      target = document.querySelector(containerProp);
    }
    if (!target) {
      target = document.querySelector('.edit-panel') || document.body;
    }
    setContainerEl(target);
  }, [containerProp]);

  useEffect(() => {
    if (isOpen) {
      // Only lock body scroll when using body-level sheet
      const isBody = (containerEl || document.body) === document.body;
      if (isBody) document.body.style.overflow = 'hidden';
      setTimeout(() => setIsActive(true), 10);
    } else {
      setIsActive(false);
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, containerEl]);

  // Preserve scroll position during re-renders
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const handleScroll = () => {
      scrollPositionRef.current = contentElement.scrollTop;
    };

    contentElement.addEventListener('scroll', handleScroll);
    return () => contentElement.removeEventListener('scroll', handleScroll);
  }, [isActive]);

  // Restore scroll position after render
  useEffect(() => {
    const contentElement = contentRef.current;
    if (contentElement && scrollPositionRef.current > 0) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        contentElement.scrollTop = scrollPositionRef.current;
      });
    }
  });

  const isBodyContainer = containerEl === document.body;

  // helpers to convert between px and style unit
  const baseHeight = () => (isBodyContainer ? window.innerHeight : (containerEl?.clientHeight || window.innerHeight));
  const toPx = (val) => {
    if (val == null) return Math.round(baseHeight() * 0.6);
    if (typeof val === 'number') return val;
    const s = String(val).trim();
    if (s.endsWith('vh')) return (parseFloat(s) / 100) * window.innerHeight;
    if (s.endsWith('%')) return (parseFloat(s) / 100) * baseHeight();
    if (s.endsWith('px')) return parseFloat(s);
    const num = parseFloat(s);
    return Number.isFinite(num) ? num : Math.round(baseHeight() * 0.6);
  };
  const toStyleHeight = (px) => {
    if (px == null) return undefined;
    if (isBodyContainer) return `${(px / window.innerHeight) * 100}vh`;
    return `${(px / baseHeight()) * 100}%`;
  };

  // initialize heightPx from prop/default
  useEffect(() => {
    const initialPx = toPx(heightProp || (isBodyContainer ? '60vh' : '60%'));
    setHeightPx(initialPx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBodyContainer, containerEl, heightProp]);

  const handleClose = () => {
    setIsActive(false);
    setIsClosing(true);
    // Reset scroll position when closing
    scrollPositionRef.current = 0;
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Drag logic wired directly on the handle
  const onMove = (clientY) => {
    if (!draggingRef.current) return;
    const delta = startYRef.current - clientY; // up -> increase height
    const minH = baseHeight() * 0.2;
    const maxH = baseHeight();
    const next = Math.min(Math.max(startHeightPxRef.current + delta, minH), maxH);
    setHeightPx(next);
  };
  const onMouseMove = (e) => onMove(e.clientY);
  const onTouchMove = (e) => {
    if (e.touches && e.touches.length) onMove(e.touches[0].clientY);
  };
  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', endDrag);
  };
  const startDrag = (clientY) => {
    draggingRef.current = true;
    startYRef.current = clientY;
    startHeightPxRef.current = heightPx ?? toPx(heightProp || (isBodyContainer ? '60vh' : '60%'));
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', endDrag);
  };

  // Determine height: prop or default per container (fallback when no drag yet)
  const resolvedHeight = toStyleHeight(heightPx);

  // Inline styles to scope overlay/sheet to container when not body
  const overlayStyle = isBodyContainer
    ? undefined
    : { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

  const sheetStyle = isBodyContainer
    ? { height: resolvedHeight }
    : { position: 'absolute', bottom: 0, left: 0, width: '100%', height: resolvedHeight };

  if ((!isOpen && !isClosing) || !containerEl) return null;

  const sheet = (
    <div
      className={`overlay ${isActive ? 'active' : ''}`}
      style={overlayStyle}
      onClick={handleBackdropClick}
    >
      <div
        className={`bottom-sheet ${isActive ? 'active' : ''}`}
        style={sheetStyle}
      >
        <div className="sheet-header">
          <div
            className="sheet-handle"
            title="Drag to resize"
            onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientY); }}
            onTouchStart={(e) => { if (e.touches && e.touches.length) { e.preventDefault(); startDrag(e.touches[0].clientY); } }}
          ></div>
          <button className="close-btn" onClick={handleClose}>✕</button>
        </div>
        {categoryFilters && (
          <div className="category-filter-section">
            <div className="category-filter-buttons">
              {categoryFilters.map((category) => (
                <button
                  key={category.key}
                  className={`category-filter-btn ${category.active ? 'active' : ''}`}
                  onClick={() => onCategoryFilterChange && onCategoryFilterChange(category.key)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="bottom-sheet-content" ref={contentRef}>
          {children}
        </div>
        <div className="sheet-footer-actionbar">
          {footerActionbar}
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, containerEl);
};

export default BottomSheet;
