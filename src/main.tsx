import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useDesignerStore } from './model/store'
import { useUiStore } from './ui/uiStore'
import { detectAtomm, registerAtommExport } from './platform/atomm'

// atomm: the export hook is registered at once (the platform may ask for
// files as soon as it shows its button); hosting is detected alongside.
registerAtommExport(() => ({
  spec: useDesignerStore.getState().spec,
  method: useUiStore.getState().method,
}))
void detectAtomm().then((hosted) => useUiStore.getState().setInAtomm(hosted))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
