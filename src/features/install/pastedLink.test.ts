import {expect,it} from 'vitest'
import {readSameOriginLoginLink} from '../auth/callback'
const token='fictitious_token_hash_12345678901234567890'
it.each(['https://ifosse-staging.netlify.app','https://deploy-preview-76--ifosse-staging.netlify.app','https://master--ifosse-staging.netlify.app','https://ifosse.netlify.app','http://localhost:5173','http://127.0.0.1:4173'])('retains same-origin callback validation for %s',origin=>{expect(readSameOriginLoginLink(` ${origin}/auth/confirm#token_hash=${token}&type=email `,origin)).toEqual({tokenHash:token})})
it.each([
 `https://ifosse.netlify.app/auth/confirm#token_hash=${token}&type=email`,
 `https://ifosse-staging.netlify.app.evil.invalid/auth/confirm#token_hash=${token}&type=email`,
 `https://person:password@ifosse-staging.netlify.app/auth/confirm#token_hash=${token}&type=email`,
 `https://ifosse-staging.netlify.app/auth/confirm?redirect=https://evil.invalid#token_hash=${token}&type=email`,
 `https://ifosse-staging.netlify.app/profil#token_hash=${token}&type=email`,
 `https://ifosse-staging.netlify.app/auth/confirm#token_hash=${token}&token_hash=${token}&type=email`,
 `https://ifosse-staging.netlify.app/auth/confirm#token_hash=${token}&type=signup`,
 'javascript:alert(1)', '/auth/confirm', 'x'.repeat(2049),
])('rejects unexpected/invalid links without relaxing callback rules: %s',value=>{expect(readSameOriginLoginLink(value,'https://ifosse-staging.netlify.app')).toEqual({invalid:true})})
