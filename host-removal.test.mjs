import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planHostRemoval,planCapacityIncrease,planViewerRemoval} from './host-removal.mjs';
const room={ownerUid:'owner',status:'collecting',schemaVersion:2,usedCount:3,reservedVideoKeys:['a','b','other']};
const submission={uid:'viewer',links:['one','two'],videoKeys:['a','b']};
const args={ownerUid:'owner',viewerUid:'viewer',url:'one'};
test('removing one video preserves the other links and frees exactly its reservation',()=>{
 const result=planHostRemoval(room,submission,args);
 assert.deepEqual(result.submission,{links:['two'],videoKeys:['b']});
 assert.deepEqual(result.room,{usedCount:2,reservedVideoKeys:['b','other'],moderatedViewerUid:'viewer'});
 assert.equal(room.usedCount,3);assert.equal(submission.links.length,2);
});
test('last video deletes only its submission; stale removal never decrements twice',()=>{
 const result=planHostRemoval(room,{uid:'viewer',links:['one'],videoKeys:['a']},args);
 assert.equal(result.submission,null);assert.equal(result.room.usedCount,2);
 assert.throws(()=>planHostRemoval(room,{uid:'viewer',links:['two'],videoKeys:['b']},args),/already_removed/);
});
test('only the room owner can remove before the tournament closes',()=>{
 assert.throws(()=>planHostRemoval(room,submission,{...args,ownerUid:'attacker'}),/owner_required/);
 assert.throws(()=>planHostRemoval({...room,status:'closed'},submission,args),/room_closed/);
 assert.throws(()=>planHostRemoval(room,{...submission,uid:'someone-else'},args),/invalid_submission/);
});

test('capacity can grow in the same room before launch, without changing submissions',()=>{
 const source={...room,capacity:16};assert.deepEqual(planCapacityIncrease(source,{ownerUid:'owner',capacity:32}),{capacity:32});assert.deepEqual(planCapacityIncrease(source,{ownerUid:'owner',capacity:64}),{capacity:64});
 for(const capacity of [16,24,48,128])assert.throws(()=>planCapacityIncrease(source,{ownerUid:'owner',capacity}));
 assert.throws(()=>planCapacityIncrease({...source,status:'closed'},{ownerUid:'owner',capacity:32}),/room_closed/);
 assert.throws(()=>planCapacityIncrease(source,{ownerUid:'other',capacity:32}),/owner_required/);
 assert.deepEqual(source.reservedVideoKeys,['a','b','other']);assert.equal(source.usedCount,3);
});

test('a viewer can remove their own confirmed videos without affecting others',()=>{
 assert.deepEqual(planViewerRemoval(room,submission,{viewerUid:'viewer'}),{usedCount:1,reservedVideoKeys:['other']});
 assert.throws(()=>planViewerRemoval(room,submission,{viewerUid:'someone-else'}),/invalid_submission/);
 assert.throws(()=>planViewerRemoval({...room,status:'closed'},submission,{viewerUid:'viewer'}),/room_closed/);
});
