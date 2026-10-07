import { expect, test } from '@playwright/test'
import { createMemberFixture, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'

test('header identity opens own profile by pointer and keyboard while logout stays separate', async ({ page }) => {
  const member=await createMemberFixture()
  try {
    await openConfirmation(page,await requestMagicLink(page,member))
    await page.getByRole('button',{name:'Se connecter',exact:true}).click()
    const identity=page.getByRole('button',{name:'Ouvrir mon profil',exact:true})
    await expect(identity).toBeVisible()
    for (const part of ['.avatar','strong','.identity-role']) {
      await identity.locator(part).click()
      await expect(page.getByRole('heading',{name:'Mon profil',exact:true})).toBeVisible()
      await expect(page.getByRole('button',{name:'Mon profil',exact:true})).toHaveAttribute('aria-current','page')
      await page.getByRole('button',{name:'Séances',exact:true}).click()
    }
    for (const key of ['Enter','Space']) {
      await page.keyboard.press('Shift+Tab') // From Séances, move back through the separate logout control.
      await expect(page.getByRole('button',{name:'Se déconnecter',exact:true})).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(identity).toBeFocused()
      expect(await identity.evaluate(element=>getComputedStyle(element).outlineStyle)).not.toBe('none')
      await page.keyboard.press(key)
      await expect(page.getByRole('heading',{name:'Mon profil',exact:true})).toBeVisible()
      await page.getByRole('button',{name:'Séances',exact:true}).click()
    }
    await page.setViewportSize({width:390,height:844})
    await identity.click()
    await expect(page.getByRole('heading',{name:'Mon profil',exact:true})).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
    const logout=page.getByRole('button',{name:'Se déconnecter',exact:true})
    expect(await identity.locator('button').count()).toBe(0)
    await logout.click()
    await expect(page.getByLabel('Adresse email')).toBeVisible()
    await expect(identity).toHaveCount(0)
    expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.endsWith('-auth-token')))).toBe(false)
  } finally { await removeMemberFixture(member) }
})
