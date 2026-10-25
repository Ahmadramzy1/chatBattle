// Pure transaction plan; Firestore independently enforces the same owner-only transition.
export function planHostRemoval(room,submission,{ownerUid,viewerUid,url}){
 if(!ownerUid||room?.ownerUid!==ownerUid)throw Error('owner_required');
 if(room.status!=='collecting')throw Error('room_closed');
 if(room.schemaVersion!==2)throw Error('unsupported_room');
 if(!submission||submission.uid!==viewerUid||!Array.isArray(submission.links)||!Array.isArray(submission.videoKeys)||submission.links.length!==submission.videoKeys.length)throw Error('invalid_submission');
 const index=submission.links.indexOf(url);if(index<0)throw Error('already_removed');
 const key=submission.videoKeys[index],keys=room.reservedVideoKeys;
 if(!Array.isArray(keys)||!keys.includes(key)||!Number.isInteger(room.usedCount)||room.usedCount<1||keys.length!==room.usedCount)throw Error('invalid_count');
 const links=submission.links.filter((_,i)=>i!==index),videoKeys=submission.videoKeys.filter((_,i)=>i!==index);
 return {submission:links.length?{links,videoKeys}:null,room:{usedCount:room.usedCount-1,reservedVideoKeys:keys.filter(k=>k!==key),moderatedViewerUid:viewerUid}};
}

export function planCapacityIncrease(room,{ownerUid,capacity}){
 if(!ownerUid||room?.ownerUid!==ownerUid)throw Error('owner_required');
 if(room.status!=='collecting')throw Error('room_closed');
 if(![16,32,64].includes(capacity)||capacity<=room.capacity||capacity<room.usedCount)throw Error('invalid_capacity');
 return {capacity};
}
export function planViewerRemoval(room,submission,{viewerUid}){
 if(room?.status!=='collecting')throw Error('room_closed');
 if(room.schemaVersion!==2)throw Error('unsupported_room');
 if(!viewerUid||submission?.uid!==viewerUid||!Array.isArray(submission.links)||!Array.isArray(submission.videoKeys)||submission.links.length!==submission.videoKeys.length||submission.links.length<1)throw Error('invalid_submission');
 const own=new Set(submission.videoKeys),all=room.reservedVideoKeys;
 if(!Array.isArray(all)||room.usedCount!==all.length||!submission.videoKeys.every(k=>all.includes(k)))throw Error('invalid_count');
 return {usedCount:room.usedCount-submission.links.length,reservedVideoKeys:all.filter(k=>!own.has(k))};
}
