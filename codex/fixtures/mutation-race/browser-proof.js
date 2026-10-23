async page => {
 const results=[];
 for(const s of [{name:'first succeeds second fails',first:0,a:true,b:false,total:10},{name:'second succeeds first fails',first:1,a:true,b:false,total:20},{name:'both succeed reverse order',first:1,a:true,b:true,total:30},{name:'both fail',first:0,a:false,b:false,total:0}]){
 await page.goto('http://127.0.0.1:49731/');
 await page.getByRole('button',{name:'Log 10 pushups',exact:true}).click();
 await page.getByRole('button',{name:'Log 20 pushups',exact:true}).click();
 await page.waitForFunction(()=>window.mock.pending.length===2);
 await page.evaluate(s=>window.mock[s.a?'complete':'fail'](s.first),s);
 await page.waitForTimeout(80);
 if(await page.evaluate(()=>window.mock.requests.filter(r=>r.method==='GET').length)!==1)throw Error('GET while pending');
 await page.evaluate(s=>window.mock[s.b?'complete':'fail'](0),s);
 await page.waitForTimeout(100);
 const label=await page.getByRole('img',{name:/Daily progress/}).getAttribute('aria-label');
 if(label!==`Daily progress ${s.total} of 100 pushups`)throw Error(s.name+': '+label);
 results.push({scenario:s.name,total:s.total,passed:true});
 }
 await page.goto('http://127.0.0.1:49731/');
 await page.getByRole('button',{name:'Log 10 pushups',exact:true}).waitFor();
 await page.evaluate(()=>{window.mock.setHoldReads(true);document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>window.mock.reads.length===1);
 await page.getByRole('button',{name:'Log 10 pushups',exact:true}).click();
 await page.evaluate(()=>{window.mock.setHoldReads(false);window.mock.complete(0);});
 await page.waitForFunction(()=>window.mock.requests.filter(r=>r.method==='GET').length===3);
 await page.evaluate(()=>window.mock.releaseRead(0));
 await page.waitForTimeout(80);
 const label=await page.getByRole('img',{name:/Daily progress/}).getAttribute('aria-label');
 if(label!=='Daily progress 10 of 100 pushups')throw Error('Stale read overwrote save: '+label);
 results.push({scenario:'pre-save GET arrives after save reconciliation',total:10,passed:true});
 return results;
}
