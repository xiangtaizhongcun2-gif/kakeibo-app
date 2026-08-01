const KEY='kurashi-kakeibo-v1';
const categories={expense:['食費','日用品','交通','住居','水道・光熱','通信','娯楽','美容・衣服','医療','教育','その他'],income:['給与','アルバイト','仕送り','臨時収入','返金','その他']};
const icons={'食費':'🍙','日用品':'🧴','交通':'🚃','住居':'🏠','水道・光熱':'💡','通信':'📱','娯楽':'🎮','美容・衣服':'👕','医療':'🏥','教育':'📚','給与':'💼','アルバイト':'🪙','仕送り':'🎁','臨時収入':'✨','返金':'↩️','その他':'・'};
let data=JSON.parse(localStorage.getItem(KEY)||'[]');
let selectedMonth=new Date(); selectedMonth.setDate(1);
let currentReceipt=''; let paymentFilter='';
const $=id=>document.getElementById(id);
const yen=n=>new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(n);
const pad=n=>String(n).padStart(2,'0');
const monthKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
function save(){localStorage.setItem(KEY,JSON.stringify(data));render()}
function setCategories(type){$('category').innerHTML=categories[type].map(x=>`<option>${x}</option>`).join('');$('paymentField').classList.toggle('hidden',type==='income')}
function render(){
 const mk=monthKey(selectedMonth); $('monthLabel').textContent=`${selectedMonth.getFullYear()}年${selectedMonth.getMonth()+1}月`;
 const monthData=data.filter(x=>x.date.startsWith(mk)); const income=monthData.filter(x=>x.type==='income').reduce((s,x)=>s+x.amount,0); const expense=monthData.filter(x=>x.type==='expense').reduce((s,x)=>s+x.amount,0); const bal=income-expense;
 $('incomeAmount').textContent=yen(income);$('expenseAmount').textContent=yen(expense);$('balanceAmount').textContent=(bal<0?'-':'')+yen(Math.abs(bal));$('balanceTrend').textContent=bal>=0?'黒字':'赤字';
 const pays={}; monthData.filter(x=>x.type==='expense').forEach(x=>{pays[x.payment]=(pays[x.payment]||0)+x.amount}); const max=Math.max(1,...Object.values(pays));
 $('paymentSummary').innerHTML=Object.keys(pays).length?Object.entries(pays).sort((a,b)=>b[1]-a[1]).map(([name,val])=>`<div class="payment-item" data-payment="${name}"><div class="payment-top"><div><div class="payment-name">${name}</div><div class="payment-meta">今月の支出</div></div><b>${yen(val)}</b></div><div class="bar"><span style="width:${val/max*100}%"></span></div></div>`).join(''):'<div class="empty-state">この月の支出はまだありません。</div>';
 document.querySelectorAll('.payment-item').forEach(el=>el.onclick=()=>{paymentFilter=el.dataset.payment;$('clearFilterBtn').classList.remove('hidden');renderTransactions(monthData)});
 renderTransactions(monthData);
}
function renderTransactions(monthData){
 let arr=[...monthData].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt); if(paymentFilter)arr=arr.filter(x=>x.payment===paymentFilter);
 $('transactionList').innerHTML=arr.length?arr.map(x=>`<div class="transaction-item" data-id="${x.id}"><div class="tx-icon">${icons[x.category]||'・'}</div><div class="tx-main"><b>${escapeHtml(x.memo)}</b><span>${x.date.replaceAll('-','/')} ・ ${x.category}${x.type==='expense'?' ・ '+x.payment:''}</span>${x.receipt?'<div class="tx-receipt">▣ レシートあり</div>':''}</div><div class="tx-amount ${x.type}">${x.type==='income'?'+':'-'}${yen(x.amount)}</div></div>`).join(''):'<div class="empty-state">記録がありません。<br>中央の「＋」から追加できます。</div>';
 document.querySelectorAll('.transaction-item').forEach(el=>el.onclick=()=>showDetail(el.dataset.id));
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function openEntry(type='expense',item=null){
 $('entryForm').reset();currentReceipt='';$('receiptPreviewWrap').classList.add('hidden');$('editId').value=item?.id||'';$('dialogTitle').textContent=item?'記録を編集':'記録を追加';$('deleteEntry').classList.toggle('hidden',!item);
 setType(item?.type||type);$('date').value=item?.date||today();$('amount').value=item?.amount||'';$('memo').value=item?.memo||'';
 if(item){setCategories(item.type);$('category').value=item.category;$('paymentMethod').value=item.payment||'現金'; if(item.receipt){currentReceipt=item.receipt;$('receiptPreview').src=currentReceipt;$('receiptPreviewWrap').classList.remove('hidden')}}
 $('entryDialog').showModal();
}
function setType(type){$('entryType').value=type;document.querySelectorAll('.type-btn').forEach(b=>b.classList.toggle('active',b.dataset.type===type));setCategories(type)}
function showDetail(id){const x=data.find(v=>v.id===id);if(!x)return;$('detailContent').innerHTML=`<h3>${escapeHtml(x.memo)}</h3><div class="detail-grid"><div class="detail-card"><span>金額</span><b>${x.type==='income'?'+':'-'}${yen(x.amount)}</b></div><div class="detail-card"><span>種類</span><b>${x.type==='income'?'収入':'支出'}</b></div><div class="detail-card"><span>日付</span><b>${x.date.replaceAll('-','/')}</b></div><div class="detail-card"><span>カテゴリ</span><b>${x.category}</b></div>${x.type==='expense'?`<div class="detail-card"><span>支払い方法</span><b>${x.payment}</b></div>`:''}</div>${x.receipt?`<img src="${x.receipt}" alt="レシート画像">`:''}<div class="detail-actions"><button class="primary-btn" id="editFromDetail">編集する</button></div>`;$('detailDialog').showModal();$('editFromDetail').onclick=()=>{$('detailDialog').close();openEntry(x.type,x)}}
$('addBtn').onclick=()=>openEntry();$('receiptQuickBtn').onclick=()=>{openEntry();setTimeout(()=>$('receiptInput').click(),250)};$('closeDialog').onclick=()=>$('entryDialog').close();$('closeDetail').onclick=()=>$('detailDialog').close();
document.querySelectorAll('.type-btn').forEach(b=>b.onclick=()=>setType(b.dataset.type));
$('prevMonth').onclick=()=>{selectedMonth.setMonth(selectedMonth.getMonth()-1);paymentFilter='';render()};$('nextMonth').onclick=()=>{selectedMonth.setMonth(selectedMonth.getMonth()+1);paymentFilter='';render()};$('monthPicker').onclick=()=>{$('monthInput').value=monthKey(selectedMonth);$('monthInput').showPicker?.()||$('monthInput').click()};$('monthInput').onchange=e=>{const [y,m]=e.target.value.split('-');selectedMonth=new Date(+y,+m-1,1);paymentFilter='';render()};
$('clearFilterBtn').onclick=()=>{paymentFilter='';$('clearFilterBtn').classList.add('hidden');render()};
$('receiptInput').onchange=e=>{const f=e.target.files[0];if(!f)return;if(f.size>2.5*1024*1024){alert('画像サイズが大きいため、2.5MB以下の画像を選んでください。');return}const r=new FileReader();r.onload=()=>{currentReceipt=r.result;$('receiptPreview').src=currentReceipt;$('receiptPreviewWrap').classList.remove('hidden')};r.readAsDataURL(f)};
$('removeReceipt').onclick=()=>{currentReceipt='';$('receiptInput').value='';$('receiptPreviewWrap').classList.add('hidden')};
$('entryForm').onsubmit=e=>{e.preventDefault();const id=$('editId').value;const item={id:id||crypto.randomUUID(),type:$('entryType').value,amount:Number($('amount').value),date:$('date').value,category:$('category').value,memo:$('memo').value.trim(),payment:$('entryType').value==='expense'?$('paymentMethod').value:'',receipt:currentReceipt,createdAt:id?(data.find(x=>x.id===id)?.createdAt||Date.now()):Date.now()};if(!item.amount||!item.memo)return;if(id)data=data.map(x=>x.id===id?item:x);else data.push(item);save();$('entryDialog').close()};
$('deleteEntry').onclick=()=>{const id=$('editId').value;if(id&&confirm('この記録を削除しますか？')){data=data.filter(x=>x.id!==id);save();$('entryDialog').close()}};
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`kakeibo-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href)};
render();setCategories('expense');
