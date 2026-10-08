// Pages end at sentence boundaries. A sentence is never shortened or clipped.
export function sentencePages(text:string,budget=620):string[]{
  if(!text)return ['No spoken message. Follow the recruiter action.'];
  const segmenter=new Intl.Segmenter('en-US',{granularity:'sentence'});const sentences=text.split(/(?<=\n\n)/).flatMap(paragraph=>[...segmenter.segment(paragraph)].map(s=>s.segment));
  const pages:string[]=[];let page='';
  for(const sentence of sentences){if(page&&page.length+sentence.length>budget){pages.push(page);page='';}page+=sentence;}
  if(page)pages.push(page);return pages;
}
