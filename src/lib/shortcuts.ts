export function shortcutAction(event:{key:string;code:string;ctrlKey:boolean;metaKey:boolean;altKey:boolean;shiftKey?:boolean;isComposing:boolean},editing:boolean,dialog:boolean){
 if(event.isComposing||event.altKey||dialog)return null;
 if((event.ctrlKey||event.metaKey)&&(event.key.toLowerCase()==='k'||event.code==='KeyK'))return 'assistant';
 if(event.ctrlKey||event.metaKey||editing)return null;
 if(event.key==='/'||event.code==='Slash'||event.code==='NumpadDivide')return 'search';
 if(event.key.toLowerCase()==='n'||event.code==='KeyN')return 'task';
 if(event.key.toLowerCase()==='f'||event.code==='KeyF')return 'focus';
 return null;
}
