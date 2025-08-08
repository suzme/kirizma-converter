'use strict'
const ver = 'Ver. 2022-01-23-1'

/**
 * 読み込み時の初期設定
 */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('version').innerText = ver
  document.getElementById('convert-button').addEventListener('click', kirizma_convert)
  document.getElementById('romaji-setting-preset').addEventListener('change', romaji_peset_changed)
})


/**
 * ローマ字変換規則プリセット設定
 */
const romaji_preset_item = 'じちふらん'.split('')
const romaji_preset = {
  'kunrei':  'ZTHRN'.split(''),  // 訓令式風
  'hepburn': 'JCFRN'.split('')   // ヘボン式風
}

// 選択変更時にチェック状態を変える
const romaji_peset_changed = e => {
  const selected = e.target.options[e.target.selectedIndex].id
  if (romaji_preset[selected]) {
    romaji_preset_item.forEach((kana, i) => {
      document.getElementsByName('romaji-' + kana).forEach(option => {
        option.checked = (option.value === romaji_preset[selected][i])
      })
    })
  }
}


/**
 * 変換メイン
 */
const kirizma_convert = () => {
  // ローマ字/かな切り替え
  const mode_ = document.getElementById('option-kirizma-mode')
  const mode = mode_.options[mode_.selectedIndex].id
  const target_vars = mode === 'kana' ? kana_vars : romaji_vars
  const convert_char = mode === 'kana' ? convert_kana : convert_romaji

  // 入力データ
  const input_dos = document.getElementById('input-dos').value
  let input_kana = document.getElementById('input-kana').value
  .replace(/[ａ-ｚＡ-Ｚ]/g, s => String.fromCharCode(s.charCodeAt() - 0xfee0)) // 半角化
  .replace(/[a-z]/g, s => String.fromCharCode(s.charCodeAt() - 0x20)) // 大文字化
  .replace(/[^あ-んーA-Z]|[ぁぃぅぇぉゃゅょっゐゑ]/g, '') // 使用可能なひらがな以外削除して配列にする

  if (mode === 'kana') {
    input_kana = input_kana.replace(/[A-Z]/g, '')
  }
  const input_kana_arr = input_kana.split('')

  // ローマ字変換規則
  const use_j = document.getElementById('romaji-じ-j').checked
  const use_c = document.getElementById('romaji-ち-c').checked
  const use_f = document.getElementById('romaji-ふ-f').checked
  const use_l = document.getElementById('romaji-ら-l').checked
  const use_x = document.getElementById('romaji-ん-x').checked

  // 譜面番号
  const in_score_no_ = document.getElementById('option-in-score-no').value
  const in_score_no = in_score_no_ === '1' ? '' : in_score_no_
  const out_score_no_ = document.getElementById('option-out-score-no').value
  const out_score_no = out_score_no_ === '1' ? '' : out_score_no_

  // 変換オプション
  const keep_onigiri = document.getElementById('option-keep-onigiri').checked
  const keep_4key = document.getElementById('option-keep-4key').checked
  const use_sleft = document.getElementById('option-use-sleft').checked

  // 譜面データの前処理
  const dos_obj = input_dos
    .replace(/\r|\n/g, '')     // 改行削除
    .replace(/&/g, '|')        // & と | に統一
    .replace(/^\|+|\|+$/g, '') // 先頭と末尾の | を削除
    .split('|')                // | で分割
    .map(s => s.split('='))    // = で分割 (left_data=200,300,400 -> ['left_data','200,300,400'])
    .filter(a => a[0].match(new RegExp('[^0-9]' + in_score_no + '_data$')))  // 指定した入力譜面番号のデータを抽出

  // 除外する変数名
  const ignore = 'acolor,color,word,back,mask,arrowMotion,frzMotion'.split(',')

  // おにぎり等をそのまま残す処理
  const keep_data = {}
  const keep = (name) => {
    ignore.push(name)
    const data = dos_obj.find(a => a[0].match(new RegExp('^' + name)))
    if (data) {
      keep_data[name] = data[1]
    } else {
      keep_data[name] = ''
    }
  }

  ['speed', 'boost'].forEach(keep)

  if (keep_onigiri) {
    ['space', 'frzSpace'].forEach(keep)
  }
  if (keep_4key) {
    if (use_sleft) {
      ['sleft', 'sdown', 'sup', 'sright', 'sfrzLeft', 'sfrzDown', 'sfrzUp', 'sfrzRight'].forEach(keep)
    } else {
      ['left', 'down', 'up', 'right', 'frzLeft', 'frzDown', 'frzUp', 'frzRight'].forEach(keep)
    }
  }

  // タイミングデータ
  const frames = dos_obj.filter(
    a => a[1] !== '' &&  // 空白は無視
    !a[0].match(         // 要らない変数を除外
      new RegExp(ignore.map(name => name + in_score_no + '_data').join('|'))
    )
  )
  .reduce((acc, val) => acc.concat(val[1].split(',')), []) // フレーム値を分割して1つの配列にまとめる
  .map(s => parseInt(s))  // 文字列になってるので数値にする
  .sort((a, b) => a - b)  // 昇順で並べ替え

  // キーごとのデータを生成
  const out_data = {}
  const out_frz_data = {}
  target_vars.forEach(name => out_data[name] = [])
  target_vars.forEach(name => out_frz_data[name] = [])

  frames.forEach((frame, i) => {
    // 「ー」の場合はスキップ
    if (input_kana_arr[i] === 'ー') {
      return
    }

    if (input_kana_arr[i + 1] && input_kana_arr[i + 1] === 'ー') {
      // 直後が「ー」の場合はフリーズアローへ割当
      out_frz_data[convert_char(input_kana_arr[i], use_j, use_c, use_f, use_l, use_x)].push(frame, frames[i + 1])
    } else if (input_kana_arr[i]) {
      // それ以外は矢印へ割当
      out_data[convert_char(input_kana_arr[i], use_j, use_c, use_f, use_l, use_x)].push(frame)
    }
  })

  // 出力譜面データの生成
  let out_str = 
    '|' + target_vars
    .map(name => 'key' + name + out_score_no + '_data=' + out_data[name].join(','))
    .join('|') + '|'
  out_str +=
    '\n|' + target_vars
    .map(name => 'frzKey' + name + out_score_no + '_data=' + out_frz_data[name].join(','))
    .join('|') + '|'

  // キープしたおにぎり等を戻す
  if (keep_4key) {
    ['left', 'down', 'up', 'right', 'frzLeft', 'frzDown', 'frzUp', 'frzRight'].forEach(name => {
      out_str += name + out_score_no + '_data=' + keep_data[(use_sleft ? 's' : '') + name] + '|'
    })
  }
  if (keep_onigiri) {
    out_str += 'space' + out_score_no + '_data=' + keep_data['space'] + '|'
    out_str += 'frzSpace' + out_score_no + '_data=' + keep_data['frzSpace'] + '|'
  }

  out_str += 'speed' + out_score_no + '_data=' + keep_data['speed'] + '|'
  out_str += 'boost' + out_score_no + '_data=' + keep_data['boost'] + '|'

  navigator.clipboard.writeText(out_str)
  document.getElementById('convert-result').className = ''
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('convert-result').className = 'convert-result-animation'
    })
  })
}


/**
 * 文字単位の変換
 */
const convert_romaji = (char, j, c, f, l, x) => {
  if (char === 'じ' && j) { return 'J' }
  if (char === 'ち' && c) { return 'C' }
  if (char === 'ふ' && f) { return 'F' }
  if (char.match(/^[ら-ろ]$/) && l) { return 'L' }
  if (char === 'ん' && x) { return 'X' }
  return romaji_table[char]
}

const convert_kana = char => kana_table[char]


/**
 * 定数
 */
// 出力譜面データの変数名生成用
const romaji_vars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const kana_vars = [
  'A', 'I', 'U', 'E', 'O',
  'KA', 'KI', 'KU', 'KE', 'KO',
  'SA', 'SI', 'SU', 'SE', 'SO',
  'TA', 'TI', 'TU', 'TE', 'TO',
  'NA', 'NI', 'NU', 'NE', 'NO',
  'HA', 'HI', 'HU', 'HE', 'HO',
  'MA', 'MI', 'MU', 'ME', 'MO',
  'YA', 'YU', 'YO',
  'RA', 'RI', 'RU', 'RE', 'RO',
  'WA', 'WO', 'NN'
]

// ローマ字時の変数名への変換表(デフォルト)
const romaji_table = {
  'あ':'A', 'い':'I', 'う':'U', 'え':'E', 'お':'O',
  'か':'K', 'き':'K', 'く':'K', 'け':'K', 'こ':'K',
  'さ':'S', 'し':'S', 'す':'S', 'せ':'S', 'そ':'S',
  'た':'T', 'ち':'T', 'つ':'T', 'て':'T', 'と':'T',
  'な':'N', 'に':'N', 'ぬ':'N', 'ね':'N', 'の':'N',
  'は':'H', 'ひ':'H', 'ふ':'H', 'へ':'H', 'ほ':'H',
  'ま':'M', 'み':'M', 'む':'M', 'め':'M', 'も':'M',
  'や':'Y', 'ゆ':'Y', 'よ':'Y',
  'ら':'R', 'り':'R', 'る':'R', 'れ':'R',
  'ろ':'R', 'わ':'W', 'を':'W', 'ん':'N',
  'が':'G', 'ぎ':'G', 'ぐ':'G', 'げ':'G', 'ご':'G',
  'ざ':'Z', 'じ':'Z', 'ず':'Z', 'ぜ':'Z', 'ぞ':'Z',
  'だ':'D', 'ぢ':'D', 'づ':'D', 'で':'D', 'ど':'D',
  'ば':'B', 'び':'B', 'ぶ':'B', 'べ':'B', 'ぼ':'B',
  'ぱ':'P', 'ぴ':'P', 'ぷ':'P', 'ぺ':'P', 'ぽ':'P'
}

romaji_vars.forEach(c => romaji_table[c] = c)

// かな入力時の変数名への変換表(デフォルト)
const kana_table = {
  'あ':'A', 'い':'I', 'う':'U', 'え':'E', 'お':'O',
  'か':'KA', 'き':'KI', 'く':'KU', 'け':'KE', 'こ':'KO',
  'さ':'SA', 'し':'SI', 'す':'SU', 'せ':'SE', 'そ':'SO',
  'た':'TA', 'ち':'TI', 'つ':'TU', 'て':'TE', 'と':'TO',
  'な':'NA', 'に':'NI', 'ぬ':'NU', 'ね':'NE', 'の':'NO',
  'は':'HA', 'ひ':'HI', 'ふ':'HU', 'へ':'HE', 'ほ':'HO',
  'ま':'MA', 'み':'MI', 'む':'MU', 'め':'ME', 'も':'MO',
  'や':'YA', 'ゆ':'YU', 'よ':'YO',
  'ら':'RA', 'り':'RI', 'る':'RU', 'れ':'RE', 'ろ':'RO',
  'わ':'WA', 'を':'WO', 'ん':'NN',
  'が':'KA', 'ぎ':'KI', 'ぐ':'KU', 'げ':'KE', 'ご':'KO',
  'ざ':'SA', 'じ':'SI', 'ず':'SU', 'ぜ':'SE', 'ぞ':'SO',
  'だ':'TA', 'ぢ':'TI', 'づ':'TU', 'で':'TE', 'ど':'TO',
  'ば':'HA', 'び':'HI', 'ぶ':'HU', 'べ':'HE', 'ぼ':'HO',
  'ぱ':'HA', 'ぴ':'HI', 'ぷ':'HU', 'ぺ':'HE', 'ぽ':'HO'
}
