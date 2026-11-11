import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './atomm.css'
import './atomm-extra.css'
import AtommApp from './AtommApp'
import { useDesignerStore } from '../model/store'
import { useUiStore } from '../ui/uiStore'
import { detectAtomm, registerAtommExport } from '../platform/atomm'
import { templates } from '../model/templates'

// The export hook is registered at once; hosting is detected alongside.
registerAtommExport(() => ({
  spec: useDesignerStore.getState().spec,
  method: useUiStore.getState().method,
}))
void detectAtomm().then((hosted) => useUiStore.getState().setInAtomm(hosted))

// A generator opens on a finished example, not on whatever was last
// edited elsewhere: start from the Flying Bird unless a design was shared in.
if (!window.location.hash.startsWith('#d=')) {
  useDesignerStore.getState().loadTemplate(templates.flyingbird)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AtommApp />
  </StrictMode>,
)
