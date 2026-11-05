import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Drawer } from "../../src/components/interior/drawer";
import { Drawer as DetailDrawer, Modal } from "../../src/components/ui/dialog";

function Preview() {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const [nested, setNested] = useState(false);
  const [modal, setModal] = useState(false);
  const [count, setCount] = useState(0);
  const [parent, setParent] = useState(false);
  const [mounted, setMounted] = useState(true);
  Object.assign(window, { drawerPreview: { setOpen, setCount, setMounted } });
  return <main className="min-h-screen bg-slate-100 p-8">
    <h1 className="mb-4 text-xl">Drawer preview</h1>
    <p className="mb-8">The background should stay softly blurred while a panel is open.</p>
    <button id="open-right" onClick={() => { setSide("right"); setOpen(true); }}>Open right</button>{" "}
    <button id="open-left" onClick={() => { setSide("left"); setOpen(true); }}>Open left</button>{" "}
    <button id="open-parent" onClick={() => setParent(true)}>Open contained panel</button>
    {mounted && <Drawer open={open} onOpenChange={setOpen} side={side} width={360} title={`Refine results ${count}`} description="24 items"
      headerActions={<button id="header-action" onClick={() => setCount((value) => value + 1)}>Refresh</button>}
      footer={<button id="show-results" onClick={() => setOpen(false)}>Show results</button>}>
      <input aria-label="Search results" placeholder="Search" />
      <button id="open-nested" onClick={() => setNested(true)}>Open detail panel</button>
      <button id="open-modal" onClick={() => setModal(true)}>Open confirmation</button>
      <button hidden>Hidden action</button><button disabled>Unavailable action</button>
      {Array.from({ length: 50 }, (_, index) => <p className="py-3" key={index}>Result {index + 1}</p>)}
    </Drawer>}
    <DetailDrawer isOpen={nested} onClose={() => setNested(false)} title="Nested details" width="md"><button id="nested-action">Detail action</button></DetailDrawer>
    <Modal isOpen={modal} onClose={() => setModal(false)} title="Confirmation"><button id="confirm-action">Confirm</button></Modal>
    <div id="parent-box" className="relative mt-8 h-96 overflow-hidden border border-stone-200">
      <Drawer open={parent} onOpenChange={setParent} title="Contained panel" container="parent" width={240} footer={<button id="parent-close" onClick={() => setParent(false)}>Done</button>}>Contained content</Drawer>
    </div>
  </main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Preview /></StrictMode>);
