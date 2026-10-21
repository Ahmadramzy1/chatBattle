export function requiresKick(room){return room?.requireKick !== false;}
export function manualName(raw){const value=String(raw??'').trim();return value.length>=2&&value.length<=64&&!/[\u0000-\u001f\u007f]/u.test(value)?value:null;}
export function submissionName(room,user,input){if(!user?.uid)return null;if(!requiresKick(room))return manualName(input);return typeof user.kickName==='string'&&user.kickName.length>0&&user.kickName.length<=64?user.kickName:null;}
