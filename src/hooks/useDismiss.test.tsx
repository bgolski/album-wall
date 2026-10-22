import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useDismiss } from "./useDismiss";

function Popup(props: { label: string; open: boolean; onDismiss: () => void; focus?: boolean }) {
  const trigger = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  useDismiss({
    open: props.open,
    inside: [trigger, panel],
    onDismiss: props.onDismiss,
    ...(props.focus === false ? {} : { returnFocus: trigger }),
  });
  return (
    <div>
      <button ref={trigger} type="button">
        {props.label} button
      </button>
      <div ref={panel}>
        <span>{props.label} content</span>
      </div>
    </div>
  );
}

function Page(props: { outer: boolean; inner: boolean; onOuter: () => void; onInner: () => void }) {
  return (
    <>
      <p>elsewhere</p>
      <Popup label="outer" open={props.outer} onDismiss={props.onOuter} />
      <Popup label="inner" open={props.inner} onDismiss={props.onInner} />
    </>
  );
}

const pressEscape = () =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useDismiss", () => {
  it("closes on a tap outside, and not on a tap on the button or inside", () => {
    const onDismiss = vi.fn();
    render(<Page outer={true} inner={false} onOuter={onDismiss} onInner={vi.fn()} />);
    fireEvent.pointerDown(screen.getByText("outer button"));
    fireEvent.pointerDown(screen.getByText("outer content"));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText("elsewhere"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("closes the open popup on a tap outside even when other popups render after it", () => {
    const onOuter = vi.fn();
    const onInner = vi.fn();
    render(<Page outer={true} inner={false} onOuter={onOuter} onInner={onInner} />);
    fireEvent.pointerDown(screen.getByText("elsewhere"));
    expect(onOuter).toHaveBeenCalledTimes(1);
    expect(onInner).not.toHaveBeenCalled();
  });

  it("does nothing while closed", () => {
    const onDismiss = vi.fn();
    render(<Page outer={false} inner={false} onOuter={onDismiss} onInner={vi.fn()} />);
    fireEvent.pointerDown(screen.getByText("elsewhere"));
    pressEscape();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("closes on Escape, returns focus to the button and keeps the key from the page", () => {
    const onDismiss = vi.fn();
    const pageListener = vi.fn();
    document.addEventListener("keydown", pageListener);
    try {
      render(<Page outer={true} inner={false} onOuter={onDismiss} onInner={vi.fn()} />);
      (screen.getByText("outer content") as HTMLElement).focus();
      pressEscape();
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(pageListener).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(screen.getByText("outer button"));
    } finally {
      document.removeEventListener("keydown", pageListener);
    }
  });

  it("leaves focus alone when no element to return to is given", () => {
    const onDismiss = vi.fn();
    render(<Popup label="tip" open={true} onDismiss={onDismiss} focus={false} />);
    const before = document.activeElement;
    pressEscape();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(before);
  });

  it("lets other keys through", () => {
    const onDismiss = vi.fn();
    const pageListener = vi.fn();
    document.addEventListener("keydown", pageListener);
    try {
      render(<Page outer={true} inner={false} onOuter={onDismiss} onInner={vi.fn()} />);
      fireEvent.keyDown(document.body, { key: "Enter" });
      expect(onDismiss).not.toHaveBeenCalled();
      expect(pageListener).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("keydown", pageListener);
    }
  });

  it("closes only the most recently opened one on Escape", () => {
    const onOuter = vi.fn();
    const onInner = vi.fn();
    const view = render(<Page outer={true} inner={false} onOuter={onOuter} onInner={onInner} />);
    view.rerender(<Page outer={true} inner={true} onOuter={onOuter} onInner={onInner} />);
    pressEscape();
    expect(onInner).toHaveBeenCalledTimes(1);
    expect(onOuter).not.toHaveBeenCalled();

    view.rerender(<Page outer={true} inner={false} onOuter={onOuter} onInner={onInner} />);
    pressEscape();
    expect(onOuter).toHaveBeenCalledTimes(1);
    expect(onInner).toHaveBeenCalledTimes(1);
  });

  it("stops listening once unmounted", () => {
    const onDismiss = vi.fn();
    const view = render(<Page outer={true} inner={false} onOuter={onDismiss} onInner={vi.fn()} />);
    view.unmount();
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
