import { useEffect } from "react";
import { useAtom } from "jotai";
import { noticeAtom } from "./state";

export function useNoticeTimeout() {
  const [notice, setNotice] = useAtom(noticeAtom);
  useEffect(() => {
    if (
      notice !== "Push notifications enabled." &&
      notice !== "Push notifications disabled."
    )
      return;
    const timer = setTimeout(
      () => setNotice((current) => (current === notice ? "" : current)),
      4000,
    );
    return () => clearTimeout(timer);
  }, [notice, setNotice]);
}
