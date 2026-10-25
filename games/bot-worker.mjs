import {botMove} from './engine.mjs?v=4';
self.onmessage=e=>{try{self.postMessage({move:botMove(e.data)});}catch{self.postMessage({error:'تعذر تحريك الجهاز'});}};
