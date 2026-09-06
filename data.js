const LESSONS=[
{id:'home',group:'en',title:'基準鍵',sub:'Home row',desc:'讓左右手回到鍵盤的家。練習 ASDF 與 JKL; 的穩定節奏。',keys:'A S D F   J K L ;',fingers:'左手小指至食指 ｜ 右手食指至小指',text:'asdf jkl; fjfj dkdk slsl a; a; fj dk sl',goal:'不用看鍵盤，連續輸入 30 個字元'},
{id:'reach',group:'en',title:'食指延伸',sub:'Reach out',desc:'食指往左右伸展，認識 G、H、R、T、Y、U 與更多鄰居。',keys:'G H R T Y U V B N M',fingers:'食指負責最寬的活動範圍',text:'fg hj fr gt hy ju vb bn nm gh rh th',goal:'保持手腕自然平直，讓食指完成延伸'},
{id:'top',group:'en',title:'上排鍵',sub:'Top row',desc:'向上探索 QWERTY，讓手指學會回到基準鍵。',keys:'Q W E R T Y U I O P',fingers:'每次按鍵後，手指回到基準鍵',text:'we type quiet work your power quite true',goal:'輸入常用單字，準確率達到 90%'},
{id:'bottom',group:'en',title:'下排鍵',sub:'Bottom row',desc:'補齊字母地圖，練習 Z、X、C、V 以及標點。',keys:'Z X C V B N M , . /',fingers:'保持雙手放鬆，不要用力敲擊',text:'mix civic box brave next move, nice.',goal:'完成一段含標點的練習文字'},
{id:'symbols',group:'en',title:'數字列與特殊符號',sub:'Shift & symbols',desc:'先切換英文半形輸入，用另一手的小指按住 Shift，再按數字列上對應的鍵。Caps Lock 不能代替 Shift 輸入符號。',keys:'! @ # $ % ^ & * ( ) ~ _ +',fingers:'左手按鍵搭配右 Shift；右手按鍵搭配左 Shift',text:'! @ # $ % ^ & * ( ) ~ _ + 1! 2@ 3# 4$ 5% 6^ 7& 8* 9( 0) 50% + 50% = 100%',goal:'練習數字與符號切換，正確使用另一手的 Shift'},
{id:'words',group:'en',title:'常用單字',sub:'Everyday words',desc:'把鍵位組合成有意義的字，速度會自然長出來。',keys:'the · and · you · with',fingers:'眼睛看前方，手指記住節奏',text:'the quick brown fox jumps over the lazy dog. practice makes progress.',goal:'不看鍵盤完成一整行單字'},
{id:'sentences',group:'en',title:'英文短句',sub:'Full sentences',desc:'把大小寫、空格與標點一起放進真實句子。',keys:'SHIFT + letters + punctuation',fingers:'小指負責 Shift，另一手輸入字母',text:'Small steps become strong habits. Keep your hands light and your eyes ahead.',goal:'完成完整句子並保持 90% 以上正確率'},
{id:'zh-home',group:'zh',rawKeys:true,title:'注音鍵位',sub:'Bopomofo map',desc:'先熟悉注音符號在鍵盤上的位置，請切換英文輸入，依標準注音按鍵練習。',keys:'ㄅ ㄆ ㄇ ㄈ   ㄉ ㄊ ㄋ ㄌ',fingers:'實體按鍵：1 Q A Z ｜ 2 W S X',text:'ㄅㄆㄇㄈ ㄉㄊㄋㄌ ㄍㄎㄏ ㄐㄑㄒ',goal:'看著注音符號，找到對應按鍵'},
{id:'zh-initial',group:'zh',rawKeys:true,title:'聲母練習',sub:'Initials',desc:'從聲母開始，讓左右手熟悉注音輸入的移動方向。',keys:'ㄍ ㄎ ㄏ ㄐ ㄑ ㄒ ㄓ ㄔ ㄕ',fingers:'一個音節一個音節輸入，保持節奏',text:'ㄍㄎㄏ ㄐㄑㄒ ㄓㄔㄕ ㄗㄘㄙ',goal:'連續輸入聲母組合，不急著求快'},
{id:'zh-final',group:'zh',rawKeys:true,title:'韻母與聲調',sub:'Finals & tones',desc:'加入韻母與聲調，認識完整的注音音節。',keys:'ㄚ ㄛ ㄜ ㄞ ㄟ ㄠ ㄡ ㄢ ㄣ ㄤ ㄥ',fingers:'先完成音節，再按下聲調',text:'ㄅㄚ ㄇㄚ ㄊㄧ ㄒㄧㄠ ㄒㄩㄝˊ ㄔㄤˊ',goal:'輸入音節時保持每一拍清楚'},
{id:'zh-combo',group:'zh',rawKeys:true,title:'常用注音組合',sub:'Sound combinations',desc:'把聲母、韻母和聲調組合起來，請切換英文輸入。',keys:'ㄅㄚ ㄇㄚ ㄋㄧˇ ㄏㄠˇ',fingers:'依照標準注音按鍵，空格使用拇指',text:'ㄅㄚ ㄇㄚ ㄋㄧˇ ㄏㄠˇ ㄒㄩㄝˊ ㄒㄧˊ',goal:'完整練習常見音節與聲調'},
{id:'zh-words',group:'zh',title:'常用詞語',sub:'Everyday words',desc:'把注音練習連成詞語，準備進入中文文章。',keys:'詞語 · 生活 · 學習 · 練習',fingers:'中文輸入法選字後，再繼續下一個詞',text:'學習 打字 需要 耐心 每天 練習 一點點 進步',goal:'熟悉選字節奏，保持輸入流暢'},
{id:'zh-sentence',group:'zh',title:'中文短句',sub:'Short sentences',desc:'輸入完整句子，練習空格、標點與中文選字。',keys:'， 。 ！ ？',fingers:'使用自己的中文輸入法與標點配置',text:'今天的練習很專心，明天的自己會更快。',goal:'正確完成一句完整的中文句子'},
{id:'zh-punctuation',group:'zh',title:'中文標點',sub:'Punctuation',desc:'分辨全形逗號、句號、問號、驚嘆號與引號。',keys:'， 。 ？ ！ 「 」',fingers:'使用自己的中文輸入法標點功能',text:'你好！今天過得好嗎？老師說：「每天練習，就會進步。」',goal:'正確輸入中文全形標點'},
{id:'zh-long',group:'zh',title:'中文段落',sub:'Long form',desc:'把注意力延長到一段文字，穩定比爆發更重要。',keys:'中文輸入 × 專注力',fingers:'每個段落都從容輸入，不追趕游標',text:'打字是一種和自己相處的練習。當手指慢慢記住每個按鍵的位置，眼睛就能回到文字本身。請保持呼吸，讓每一次輸入都清楚而有節奏。',goal:'完成段落，讓正確率成為速度的地基'}];
const EN_TEXTS=['The best way to learn is to begin with one small step. Keep your hands light and your eyes ahead.','A quiet morning gives us room to think, practice, and make something better than yesterday.','Small habits become strong skills when we return to them with patience and a curious mind.','The quick brown fox jumps over the lazy dog. This sentence visits every letter on the keyboard.','Good typing is not a race at the beginning. It is a steady conversation between eyes and hands.','Write one clear sentence, then another. Progress often hides inside ordinary practice.','When a mistake appears, pause, breathe, and continue. Accuracy gives speed a place to grow.','Our classroom is a place for questions, experiments, and the quiet sound of learning together.','You do not need perfect hands. You only need to notice where they are and try again.','The keyboard is a map. Each key becomes familiar when we visit it often enough.','Take your time with every space and mark. Careful details make writing easy to read.','A clear plan turns a large task into a series of friendly, manageable steps.','Practice can be calm and useful. Let the rhythm of the letters guide you forward.','Today we build a foundation. Tomorrow we can use it to reach a little farther.','Keep learning, keep asking, and keep making room for the next good idea.'];
const ZH_TEXTS=['每天留一點時間練習打字，手指會慢慢記住鍵盤上的路。當輸入變得穩定，想法就能更自在地留下來。','學習不是和別人比較快，而是看見今天的自己比昨天更熟悉一點。請保持耐心，讓進步自然發生。','一段文字從第一個字開始，經過空格、標點和每一次修正，最後成為清楚又完整的想法。','在安靜的教室裡，手指敲擊鍵盤的聲音像一種節奏。專心聽見它，你會找到自己的速度。','正確率是速度的地基。先讓每個字清楚落在正確的位置，再慢慢增加連續輸入的時間。','遇到不熟悉的按鍵時，不必急著跳過。停下來看一看，下一次你就會更有把握。','每個人都有自己的學習節奏。重要的是願意開始，也願意在出錯之後重新試一次。','文字可以記錄問題、分享觀察，也可以把一個還沒有完成的想法，送到更遠的地方。','今天的練習不需要很長，只要專注完成一小段，就能為下一次輸入留下清楚的線索。','請把雙手放鬆，肩膀自然下沉，眼睛看著文字，讓手指負責找到正確的按鍵。','我們從基準鍵出發，向上探索字母，再向下補齊地圖。熟悉之後，文章會變得更容易。','好的工具不會代替練習，但會讓練習更清楚。看見自己的紀錄，就是看見下一個方向。','當你能穩定輸入一行文字，就已經完成一次小小的挑戰。累積很多小挑戰，就會走得更遠。','閱讀和打字一樣，都需要眼睛與手指合作。保持節奏，讓每個字都有自己的位置。','謝謝今天願意坐下來練習的自己。下一次回到鍵盤前，你會發現有些路已經記住了。'];
// Longer passages keep the 120-second option useful; each passage starts with a distinct topic.
const ZH_EXTENSIONS = [
'練習開始前，我們先整理桌面，把不需要的東西放好。坐穩之後，讓肩膀自然放鬆，雙腳平放地面。找到鍵盤上的基準位置，摸摸食指下方的小凸點，再看向螢幕上的文字。一開始不必追求快速，只要讓每個字元都落在正確的位置。',
'遇到錯字時，可以先停一下，確認是字母、空格還是標點出了差錯。用刪除鍵修正後，再慢慢繼續。如果某個按鍵總是不熟悉，就把它和前後的字一起多練幾次。每天留幾分鐘觀察自己的習慣，比一次練很久更容易保持專注。',
'同學之間可以分享練習方法，也可以互相提醒坐姿與指法。有人擅長英文，有人比較熟悉中文輸入，每個人的起點都不一樣。看見別人的進步時送上一句鼓勵，也別忘了肯定自己的努力。學習的教室，需要耐心，也需要互相尊重。',
'一段文章裡，空格和標點都有自己的工作。逗號讓句子稍作停頓，句號表示一個想法已經說完。中文輸入時，確認選字之後再繼續下一個詞，可以減少回頭修正的次數。慢慢建立穩定的節奏，讓眼睛與手指一起合作。',
'完成測驗後，先看看正確率，再看看速度。把這次的結果和自己上一次的表現相比，就能發現一點線索。速度暫時沒有提高，也可能是因為你開始注意更多細節。休息一下，喝口水，下次再回到鍵盤前，繼續累積熟悉感。'
];
for (let i = 0; i < ZH_TEXTS.length; i++) {
  ZH_TEXTS[i] += Array.from({length:5}, (_,j) => ZH_EXTENSIONS[(i + j) % ZH_EXTENSIONS.length]).join('');
}
for (let i = 0; i < EN_TEXTS.length; i++) {
  EN_TEXTS[i] += ' ' + ['Place your fingers on the home row and keep your shoulders relaxed.', 'Read the next word before you type it. Every space and punctuation mark has a place.', 'If a letter is wrong, use Backspace and try again. Take a short break when you need one.', 'Compare your work with your own earlier practice. A calm rhythm helps you learn.'].join(' ');
}

// Standard US English layout; top-row shifted symbols.
const SHIFT_PAIRS = [['`','~'],['1','!'],['2','@'],['3','#'],['4','$'],['5','%'],['6','^'],['7','&'],['8','*'],['9','('],['0',')'],['-','_'],['=','+']];
