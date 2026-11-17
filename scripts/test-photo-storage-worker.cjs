const assert=require('node:assert/strict');
const path=require('node:path');
const {createTypeScriptLoader}=require('./lib/load-typescript.cjs');
async function scenario(mode){
  const log=[];let claimed=false;let pointer='photos/old.webp';let old=[];
  const body=Buffer.from('unchanged-watermarked-webp-bytes');const objects=new Map([[pointer,body]]);
  const photo={id:42,r2_key:pointer,movement_type:'purchase_inward',subplate_id:null,stage_key:null,server_uploaded_at:'2026-11-16T10:00:00Z',deleted_at:mode==='deleted'?'2026-11-16T11:00:00Z':null};
  const db={
    from(table){
      const filters={};let single=false,remove=false,count=false;
      const q=new Proxy({}, {get(_,key){
        if(key==='then')return resolve=>{
          let data=[],n=null;
          if(table==='photo_project_associations')data=[{project_code:'MOULD-A'},{project_code:'MOULD-B'}];
          if(table==='photo_event_associations')data=single?{created_at:photo.server_uploaded_at}:[{event_id:'receipt:5',document_id:5,document_number:'SM/PR/005'}];
          if(table==='photo_storage_old_keys'){
            if(remove){log.push('remove-journal');old=old.filter(k=>k.object_key!==filters.object_key);}
            else data=old;
          }
          if(table==='movement_photos'&&count){n=filters.r2_key===pointer&&!photo.deleted_at?1:0;data=null;}
          return Promise.resolve({data,error:null,count:n}).then(resolve);
        };
        return(...args)=>{if(key==='eq')filters[args[0]]=args[1];if(key==='maybeSingle')single=true;if(key==='delete')remove=true;if(key==='select'&&args[1]?.count)count=true;return q;};
      }});return q;
    },
    async rpc(name,args){
      log.push(name);
      if(name==='claim_photo_storage_move'){if(claimed)return{data:null};claimed=true;return{data:{photo,token:'lease',revision:1}};}
      if(name==='prepare_photo_storage_move'){old.push({object_key:args.p_target,created_at:'2026-01-01',photo_id:42});return{data:true};}
      if(name==='finish_photo_storage_move'){
        if(args.p_error)return{data:false};
        if(mode==='deleted')return{data:false};
        assert.ok(objects.has(args.p_new),'copy exists before publishing pointer');
        assert.deepEqual(objects.get(args.p_new),body,'copy is byte-identical');
        if(mode==='db-failure')return{error:{message:'database unavailable'}};
        pointer=args.p_new;old=old.filter(k=>k.object_key!==pointer);old.push({object_key:args.p_old,created_at:'2026-01-01',photo_id:42});return{data:true};
      }
      return{data:true};
    },
  };
  const load=createTypeScriptLoader(path.resolve(__dirname,'..'),{
    '@/lib/supabase/admin':{supabaseAdmin:db},
    '@/lib/r2/client':{
      getFromR2Buffer:async key=>{log.push('read:'+key);if(mode==='missing'&&key===photo.r2_key)return null;if(mode==='corrupt'&&key!==photo.r2_key)return Buffer.from('wrong');return objects.get(key)||null;},
      uploadToR2:async({key,body})=>{log.push('copy');objects.set(key,body);},
      deleteFromR2:async key=>{log.push('delete:'+key);objects.delete(key);return true;},
    },
  });
  const result=await load(path.resolve(__dirname,'../src/lib/photos/storage-moves.ts')).runPhotoStorageMoves(1);
  if(mode==='deleted'){
    assert.equal(result.cleaned,1);assert.equal(result.moved,0);assert.equal(result.failed,0);assert.ok(!objects.has(pointer));assert.ok(!log.includes('copy'),'deleted photos are never recopied');
  }else if(mode==='ok'){
    assert.equal(result.moved,1);assert.equal(result.cleaned,1);assert.match(pointer,/^shared\/purchase_inward\/SM-PR-005__5\//);
    assert.equal(objects.has(photo.r2_key),false);assert.ok(log.indexOf('copy')<log.indexOf('finish_photo_storage_move'));
    assert.ok(log.findIndex(x=>x.startsWith('delete:'))<log.indexOf('release_photo_storage_move'),'cleanup holds photo lease');
  }else{assert.equal(result.failed,1);assert.equal(pointer,photo.r2_key);assert.deepEqual(objects.get(pointer),body);assert.ok(!log.some(x=>x.startsWith('delete:')),'failed migration preserves source');}
}
(async()=>{for(const mode of ['ok','missing','corrupt','db-failure','deleted'])await scenario(mode);console.log('PASS: worker copies, verifies, atomically switches and cleans under lease; failures preserve the source and deletion races clean tombstoned objects.');})().catch(e=>{console.error(e);process.exitCode=1;});
