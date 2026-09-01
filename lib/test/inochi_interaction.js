/* =========================================================
   Inochi2D Interaction Module
   ---------------------------------------------------------
   ユーザー操作だけを担当。
   担当:
   - pointer down / move / up
   - ドラッグ量の計算
   - interaction impulse の生成
   - secondary motion への通知
   - pointer 状態管理
   非担当:
   - パラメータ
   - 口パク
   - 瞬き
   - 視線
   - 表情
   - アニメーション
   - カメラ
   - secondary motion 本体
   ========================================================= */
export function createInteractionController({
  canvas = null,
  /*
   * secondary motion 側へ衝撃を渡す関数。
   *
   * 本体側:
   *   deltaX / deltaY
   * を受け取って secondaryMotion.inject(...)
   * などを実行する。
   */
  onImpulse = null,
  /*
   * クリック / タップ時の callback。
   */
  onPointerDown = null,
  onPointerUp = null,
  onPointerCancel = null,
  /*
   * ドラッグ中の callback。
   */
  onPointerMove = null,
  /*
   * デバッグ。
   */
  debugEnabled = false,
  /*
   * 小さすぎる移動を無視する。
   */
  minDelta = 0,
  /*
   * 衝撃の強さ。
   *
   * 1 = 元の移動量そのまま。
   */
  impulseScale = 1,
  /*
   * 一度に送る最大値。
   * Infinity にすると制限なし。
   */
  maxImpulse = Infinity,
  /*
   * 操作対象を限定する場合。
   *
   * 例:
   *   ['mouse', 'touch', 'pen']
   *
   * null なら全部許可。
   */
  allowedPointerTypes = null,
}) {
  let mounted = false;
  let activePointerId = null;
  let pointerDown = false;
  let lastX = 0;
  let lastY = 0;
  let totalDistance = 0;
  let impulseCount = 0;
  let lastDeltaX = 0;
  let lastDeltaY = 0;
  const log = (...args) => {
    if (debugEnabled) {
      console.info(
        '[Inochi2D interaction]',
        ...args,
      );
    }
  };
  const clampImpulse = (value) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    if (!Number.isFinite(maxImpulse)) {
      return value;
    }
    return Math.max(
      -Math.abs(maxImpulse),
      Math.min(
        Math.abs(maxImpulse),
        value,
      ),
    );
  };
  const isAllowedPointerType = (event) => {
    if (!Array.isArray(allowedPointerTypes)) {
      return true;
    }
    return allowedPointerTypes.includes(
      event.pointerType,
    );
  };
  const getCanvasPoint = (event) => {
    if (!canvas) {
      return {
        x: event.clientX,
        y: event.clientY,
      };
    }
    const rect =
      canvas.getBoundingClientRect();
    /*
     * canvas の表示サイズを基準にする。
     *
     * devicePixelRatio はここでは掛けない。
     * interaction は CSS pixel ベースで扱う。
     */
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };
  const emitImpulse = (
    deltaX,
    deltaY,
  ) => {
    if (
      !Number.isFinite(deltaX) ||
      !Number.isFinite(deltaY)
    ) {
      return;
    }
    if (
      Math.abs(deltaX) < minDelta &&
      Math.abs(deltaY) < minDelta
    ) {
      return;
    }
    const scaledX =
      clampImpulse(deltaX * impulseScale);
    const scaledY =
      clampImpulse(deltaY * impulseScale);
    lastDeltaX = scaledX;
    lastDeltaY = scaledY;
    totalDistance += Math.hypot(
      scaledX,
      scaledY,
    );
    impulseCount += 1;
    if (typeof onImpulse === 'function') {
      onImpulse(
        scaledX,
        scaledY,
        {
          originalDeltaX: deltaX,
          originalDeltaY: deltaY,
          pointerId: activePointerId,
        },
      );
    }
    log('impulse', {
      deltaX: scaledX,
      deltaY: scaledY,
    });
  };
  const handlePointerDown = (event) => {
    if (!isAllowedPointerType(event)) {
      return;
    }
    /*
     * すでに別 pointer を掴んでいる場合は無視。
     */
    if (
      activePointerId !== null &&
      activePointerId !== event.pointerId
    ) {
      return;
    }
    activePointerId =
      event.pointerId;
    pointerDown = true;
    const point =
      getCanvasPoint(event);
    lastX = point.x;
    lastY = point.y;
    totalDistance = 0;
    lastDeltaX = 0;
    lastDeltaY = 0;
    /*
     * Pointer Capture が使える場合は、
     * canvas 外までドラッグしても追跡する。
     */
    try {
      canvas?.setPointerCapture?.(
        event.pointerId,
      );
    } catch {
      // Pointer Capture 非対応環境は無視。
    }
    if (typeof onPointerDown === 'function') {
      onPointerDown({
        event,
        x: point.x,
        y: point.y,
        pointerId: event.pointerId,
        pointerType:
          event.pointerType,
      });
    }
    log('pointer down', {
      x: point.x,
      y: point.y,
      pointerId: event.pointerId,
    });
  };
  const handlePointerMove = (event) => {
    if (!pointerDown) {
      return;
    }
    if (
      activePointerId !== null &&
      activePointerId !== event.pointerId
    ) {
      return;
    }
    if (!isAllowedPointerType(event)) {
      return;
    }
    const point =
      getCanvasPoint(event);
    const deltaX =
      point.x - lastX;
    const deltaY =
      point.y - lastY;
    lastX = point.x;
    lastY = point.y;
    if (
      deltaX === 0 &&
      deltaY === 0
    ) {
      return;
    }
    emitImpulse(
      deltaX,
      deltaY,
    );
    if (typeof onPointerMove === 'function') {
      onPointerMove({
        event,
        x: point.x,
        y: point.y,
        deltaX,
        deltaY,
        pointerId:
          event.pointerId,
        pointerType:
          event.pointerType,
        totalDistance,
      });
    }
  };
  const releasePointer = (
    event,
    cancelled = false,
  ) => {
    if (
      activePointerId !== null &&
      event.pointerId !== activePointerId
    ) {
      return;
    }
    const point =
      getCanvasPoint(event);
    const pointerId =
      activePointerId;
    pointerDown = false;
    activePointerId = null;
    try {
      canvas?.releasePointerCapture?.(
        event.pointerId,
      );
    } catch {
      // Pointer Capture 非対応環境は無視。
    }
    const payload = {
      event,
      x: point.x,
      y: point.y,
      pointerId,
      pointerType:
        event.pointerType,
      totalDistance,
      lastDeltaX,
      lastDeltaY,
    };
    if (cancelled) {
      if (
        typeof onPointerCancel ===
        'function'
      ) {
        onPointerCancel(payload);
      }
      log('pointer cancel');
    } else {
      if (
        typeof onPointerUp ===
        'function'
      ) {
        onPointerUp(payload);
      }
      log('pointer up');
    }
  };
  const handlePointerUp = (event) => {
    releasePointer(
      event,
      false,
    );
  };
  const handlePointerCancel = (event) => {
    releasePointer(
      event,
      true,
    );
  };
  const handleLostPointerCapture = (
    event,
  ) => {
    if (
      activePointerId ===
      event.pointerId
    ) {
      pointerDown = false;
      activePointerId = null;
    }
  };
  /*
   * -------------------------------------------------------
   * mount / unmount
   * -------------------------------------------------------
   */
  const mount = () => {
    if (mounted) {
      return;
    }
    if (!canvas) {
      throw new Error(
        'Inochi2D interaction requires a canvas.',
      );
    }
    canvas.addEventListener(
      'pointerdown',
      handlePointerDown,
    );
    canvas.addEventListener(
      'pointermove',
      handlePointerMove,
    );
    canvas.addEventListener(
      'pointerup',
      handlePointerUp,
    );
    canvas.addEventListener(
      'pointercancel',
      handlePointerCancel,
    );
    canvas.addEventListener(
      'lostpointercapture',
      handleLostPointerCapture,
    );
    /*
     * ブラウザ側のスクロールや
     * pinch 操作によって pointermove が
     * 奪われるのを防ぐ。
     */
    if (
      canvas.style &&
      !canvas.style.touchAction
    ) {
      canvas.style.touchAction = 'none';
    }
    mounted = true;
    log('mounted');
  };
  const unmount = () => {
    if (!mounted) {
      return;
    }
    canvas?.removeEventListener(
      'pointerdown',
      handlePointerDown,
    );
    canvas?.removeEventListener(
      'pointermove',
      handlePointerMove,
    );
    canvas?.removeEventListener(
      'pointerup',
      handlePointerUp,
    );
    canvas?.removeEventListener(
      'pointercancel',
      handlePointerCancel,
    );
    canvas?.removeEventListener(
      'lostpointercapture',
      handleLostPointerCapture,
    );
    mounted = false;
    pointerDown = false;
    activePointerId = null;
    lastX = 0;
    lastY = 0;
    totalDistance = 0;
    lastDeltaX = 0;
    lastDeltaY = 0;
    log('unmounted');
  };
  /*
   * -------------------------------------------------------
   * 外部から衝撃を発生させる
   * -------------------------------------------------------
   *
   * 例えば:
   *
   * interactionController.emitImpulse(5, -2);
   *
   * のように使える。
   */
  const applyImpulse = (
    deltaX,
    deltaY,
  ) => {
    emitImpulse(
      Number.isFinite(deltaX)
        ? deltaX
        : 0,
      Number.isFinite(deltaY)
        ? deltaY
        : 0,
    );
  };
  /*
   * -------------------------------------------------------
   * 状態
   * -------------------------------------------------------
   */
  const getState = () => ({
    mounted,
    pointerDown,
    activePointerId,
    x: lastX,
    y: lastY,
    totalDistance,
    lastDeltaX,
    lastDeltaY,
    impulseCount,
  });
  const reset = () => {
    pointerDown = false;
    activePointerId = null;
    lastX = 0;
    lastY = 0;
    totalDistance = 0;
    lastDeltaX = 0;
    lastDeltaY = 0;
    impulseCount = 0;
  };
  return {
    mount,
    unmount,
    emitImpulse: applyImpulse,
    getState,
    reset,
    isMounted: () => mounted,
    isPointerDown: () => pointerDown,
  };
}
