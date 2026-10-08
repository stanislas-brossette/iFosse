import { cleanup,render } from '@testing-library/react'
import { afterEach,expect,it } from 'vitest'
import { useUnsavedChanges } from './navigation'
afterEach(cleanup)
function Form({dirty}:{dirty:boolean}) { useUnsavedChanges(dirty);return <input aria-label="Saisie" /> }
it('warns on refresh only for dirty mounted forms and removes the guard on unmount',()=>{
  const view=render(<Form dirty={false} />)
  const unload=()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented}
  expect(unload()).toBe(false);view.rerender(<Form dirty />);expect(unload()).toBe(true)
  view.rerender(<Form dirty={false} />);expect(unload()).toBe(false);view.rerender(<Form dirty />);view.unmount();expect(unload()).toBe(false)
})
