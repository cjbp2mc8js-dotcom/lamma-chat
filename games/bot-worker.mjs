import {botMove} from './engine.mjs';
self.onmessage=e=>{try{self.postMessage({move:botMove(e.data)});}catch{self.postMessage({error:'تعذر تحريك الجهاز'});}};
