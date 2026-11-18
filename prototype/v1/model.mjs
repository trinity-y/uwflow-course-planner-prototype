export const courses=[
 ['SE101','SE 101','Introduction to Software Engineering','core',[],['Fall'],0],
 ['CS135','CS 135','Designing Functional Programs','core',[],['Fall','Winter'],0],
 ['MATH115','MATH 115','Linear Algebra for Engineering','core',[],['Fall'],0],
 ['PHYS121','PHYS 121','Mechanics','science',[],['Fall','Winter'],0],
 ['SE102','SE 102','Software Design I','core',['SE101'],['Winter'],1],
 ['CS136','CS 136','Data Structures','core',['CS135'],['Winter','Spring'],1],
 ['MATH135','MATH 135','Algebra for Honours Mathematics','core',['MATH115'],['Winter','Fall'],1],
 ['SE201','SE 201','Software Design II','core',['SE102'],['Fall','Spring'],3],
 ['CS246','CS 246','Object-Oriented Software Development','core',['CS136'],['Fall','Winter'],3],
 ['MATH137','MATH 137','Calculus for Honours Mathematics','core',['MATH135'],['Fall','Winter'],3],
 ['SE202','SE 202','Requirements Engineering','core',['SE201'],['Winter'],4],
 ['CS251','CS 251','Computer Organization & Architecture','core',['CS246'],['Winter','Spring'],4],
 ['STAT230','STAT 230','Probability','core',['MATH137'],['Fall','Winter','Spring'],4],
 ['CS341','CS 341','Algorithms','core',['CS246'],['Fall','Spring'],6],
 ['SE301','SE 301','Project Management','core',['SE202'],['Fall'],6],
 ['CS446','CS 446','Machine Learning','technical',['CS246'],['Winter'],null],
 ['CS456','CS 456','Computer Vision','technical',['CS341'],['Fall'],null],
 ['STAT341','STAT 341','Statistical Methods','technical',['STAT230'],['Winter','Spring'],null],
 ['CS454','CS 454','Algorithms II','technical',['CS341'],['Winter'],null],
 ['SE463','SE 463','Software Design and Architecture','technical',['SE201'],['Fall'],null],
 ['PSYCH101','PSYCH 101','Introductory Psychology','listc',[],['Fall','Winter','Spring'],null],
 ['CHEM120','CHEM 120','General Chemistry','science',[],['Fall','Winter'],null],
 ['PD20','PD 20','Engineering Workplace Skills','pd',[],['Fall','Winter','Spring'],null],
 ['PD21','PD 21','Engineering Professionalism','pd',[],['Fall','Winter','Spring'],null],
 ['PD22','PD 22','Professional Development','pd',[],['Fall','Winter','Spring'],null],
 ['CS145','CS 145','Advanced Functional Programming','free',[],['Fall'],null]
].map(([id,code,name,group,prereqs,offered,term])=>({id,code,name,group,prereqs,offered,term,credits:group==='pd'?0:.5,anti:id==='CS145'?['CS135']:id==='CS135'?['CS145']:[]}));
export const byId=Object.fromEntries(courses.map(c=>[c.id,c]));
export const groups={pd:{name:'Professional development',target:3},core:{name:'Core requirements',target:17},technical:{name:'Technical electives',target:4},science:{name:'Science electives',target:2},listc:{name:'List C electives',target:2},free:{name:'Free electives',target:1}};
export const streams={SE:['8X','8Y'],CE:['4X','8X']};
export const patterns={'8X':[0,1,3,4,6,8,10,12],'8Y':[0,1,3,4,6,7,10,12],'4X':[0,2,4,6,8,10,12,14]};
export function initial(){return {program:'SE',stream:'8X',calendar:'2024–2025',startYear:2024,startSeason:'Fall',fullDegree:false,showWork:true,collapsed:{},hideSidebar:false,completedTerms:{},completed:['SE101','CS135','MATH115','PHYS121'],positions:Object.fromEntries(courses.filter(c=>c.term!==null).map(c=>[c.id,c.term])),wishlist:['CS446','CS456','STAT341','CS454','SE463'],limit:5,termCount:15,termTypes:{},viewStart:0,selected:'CS246'};}
export function term(s,i){const seasons=['Winter','Spring','Fall'],absolute=s.startYear*3+seasons.indexOf(s.startSeason||'Fall')+i,season=seasons[((absolute%3)+3)%3],study=patterns[s.stream].includes(i),n=patterns[s.stream].indexOf(i),type=s.termTypes[i]||(study?'Study':'Work');return {season,year:Math.floor(absolute/3),title:season+' '+Math.floor(absolute/3),type,level:study?`${Math.floor(n/2)+1}${n%2?'B':'A'}`:'Co-op'};}
export function degreeTermCount(startYear,startSeason,endYear,endSeason){const seasons=['Winter','Spring','Fall'];return (endYear-startYear)*3+seasons.indexOf(endSeason)-seasons.indexOf(startSeason)+1;}
export function visibleTerms(s,view){return Array.from({length:s.termCount},(_,i)=>i).filter(i=>view==='roadmap'?term(s,i).type==='Study':s.showWork!==false||term(s,i).type!=='Work');}
export function issues(s,id,t=s.positions[id]){if(t==null||s.completed.includes(id))return [];const c=byId[id],out=[],tm=term(s,t);if(tm.type!=='Study'&&!(tm.type==='Work'&&c.group==='pd'))out.push(`Scheduled during a ${tm.type.toLowerCase()} term`);if(!c.offered.includes(tm.season))out.push(`Not offered in ${tm.season}; offered ${c.offered.join(', ')}`);c.prereqs.forEach(p=>{if(s.completed.includes(p)?(s.completedTerms?.[p]!=null&&s.completedTerms[p]>=t):(s.positions[p]==null||s.positions[p]>=t))out.push(`${byId[p].code} must be completed in an earlier term`)});c.anti.forEach(p=>{if(s.completed.includes(p)||s.positions[p]!=null)out.push(`Antirequisite conflict with ${byId[p].code}`)});if(Object.entries(s.positions).filter(([k,v])=>v===t&&!s.completed.includes(k)).length>s.limit)out.push(`Exceeds the ${s.limit}-course limit`);return out;}
export function allIssues(s){return courses.flatMap(c=>issues(s,c.id).map(message=>({id:c.id,message})));}
export function coverage(s,g,planned=false){return Math.min(groups[g].target,courses.filter(c=>c.group===g&&(s.completed.includes(c.id)||(planned&&s.positions[c.id]!=null&&!issues(s,c.id).length))).length);}
export function generate(s){const next=structuredClone(s),unplaced=[];const candidates=[...courses.filter(c=>c.group==='core').map(c=>c.id),...s.wishlist];for(const id of [...new Set(candidates)]){if(next.completed.includes(id)||next.positions[id]!=null)continue;let found=false;for(let t=1;t<next.termCount;t++){next.positions[id]=t;if(!issues(next,id).length){found=true;break;}}if(!found){delete next.positions[id];unplaced.push(id);}}return {next,unplaced};}
