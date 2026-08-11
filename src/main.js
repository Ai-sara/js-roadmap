import './style.css'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-light.css'

// ---------- Темы ----------
import categories from '../content/categories.json'
const topicModules = import.meta.glob('../content/topics/**/*.json', { eager: true })
// ---------- Задачи ----------
import taskList from '../content/tasks-list.json'
const taskModules = import.meta.glob('../content/tasks/*.json', { eager: true })

// ---------- Вопросы ----------
import questionList from '../content/questions-list.json'
const questionModules = import.meta.glob('../content/questions/*.json', { eager: true })

// ---------- Проекты ----------
import projectList from '../content/projects-list.json'
const projectModules = import.meta.glob('../content/projects/*.json', { eager: true })

function buildById(modules) {
    return Object.values(modules).reduce((acc, mod) => {
        acc[mod.default.id] = mod.default
        return acc
    }, {})
}

const topicsById = buildById(topicModules)
const tasksById = buildById(taskModules)
const questionsById = buildById(questionModules)
const projectsById = buildById(projectModules)

const sections = {
    topic:    { byId: topicsById,    list: categories,   label: 'Темы' },
    task:     { byId: tasksById,     list: taskList,     label: 'Задачи' },
    question: { byId: questionsById, list: questionList, label: 'Вопросы' },
    project:  { byId: projectsById,  list: projectList,  label: 'Проекты' },
}
function flattenLeaves(id) {
    const node = topicsById[id]
    if (!node) {
        console.error('Не найден узел для id:', id)
        return []
    }
    if (node.children) {
        return node.children.flatMap(flattenLeaves)
    }
    return [id]
}
const leafOrder = categories.flatMap(flattenLeaves)

const blockRenderers = {
    heading_xl: (block) => `<h1>${block.content}</h1>`,
    heading: (block) => `<h2>${block.content}</h2>`,
    heading_sm: (block) => `<h3>${block.content}</h3>`,
    text: (block) => `<p>${block.content}</p>`,
    note: (block) => `<div class="note">${block.content}</div>`,
    code: (block) => {
        const lines = block.content.split('\n')
        const numbers = lines.map((_, i) => i + 1).join('\n')
        const langClass = `language-${block.lang || 'javascript'}`
        return `<div class="code-block">
                    <pre class="code-gutter">${numbers}</pre>
                    <pre class="code-content"><code class="${langClass}">${block.content}</code></pre>
                  </div>`
    },
    list: (block) => `<ul>${block.items.map(item => `<li>${item}</li>`).join('')}</ul>`,
    scheme: (block) => {
        if (Array.isArray(block.content)) {
            const steps = block.content
                .map(step => `<span class="scheme-step">${step}</span>`)
                .join('<span class="scheme-arrow">→</span>')
            return `<div class="scheme-flow">${steps}</div>`
        }
        return `<pre class="scheme">${block.content}</pre>`
    },
    table: (block) => {
        const headerHtml = block.headers.map(h => `<th>${h}</th>`).join('')
        const rowsHtml = block.rows
            .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
            .join('')
        return `<table class="content-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`
    },
}

function renderBlock(block) {
    const renderer = blockRenderers[block.type]
    if (!renderer) {
        console.warn('Неизвестный тип блока:', block.type)
        return ''
    }
    return renderer(block)
}

function renderBlocks(blocks) {
    return blocks.map(renderBlock).join('')
}

function renderTopNav(activeSection) {
    const items = Object.entries(sections)
        .map(([key, s]) => {
            const activeClass = key === activeSection ? ' class="active"' : ''
            return `<a href="#${key}"${activeClass}>${s.label}</a>`
        })
        .join('')
    return `<nav class="topnav">${items}</nav>`
}

function renderTopicGroup(node) {
    const links = node.children
        .map(childId => topicsById[childId])
        .map(child => `<li><a href="#topic/${child.id}">${child.title}</a></li>`)
        .join('')
    return `<h1>${node.title}</h1><ul class="node-list">${links}</ul>`
}

function getBreadcrumbs(id) {
    const chain = []
    let current = topicsById[id]
    while (current) {
        chain.unshift(current)
        current = current.parentId ? topicsById[current.parentId] : null
    }
    return chain
}

function renderBreadcrumbs(id) {
    const chain = getBreadcrumbs(id)
    const parts = chain.map((node, i) => {
        const isLast = i === chain.length - 1
        return isLast ? node.title : `<a href="#topic/${node.id}">${node.title}</a>`
    })
    return `<nav class="breadcrumbs">${['<a href="#topic">Темы</a>', ...parts].join(' / ')}</nav>`
}

function renderSiblingNav(node) {
    const index = leafOrder.indexOf(node.id)
    const prevId = leafOrder[index - 1]
    const nextId = leafOrder[index + 1]
    const prevLink = prevId ? `<a href="#topic/${prevId}" class="nav-prev">← ${topicsById[prevId].title}</a>` : '<span></span>'
    const nextLink = nextId ? `<a href="#topic/${nextId}" class="nav-next">${topicsById[nextId].title} →</a>` : '<span></span>'
    return `<div class="sibling-nav">${prevLink}${nextLink}</div>`
}

function renderTopicItem(node) {
    const backButton = `<a href="#topic" class="back-btn">← Все темы</a>`
    if (node.children) {
        return backButton + renderBreadcrumbs(node.id) + renderTopicGroup(node)
    }
    return backButton + renderBreadcrumbs(node.id) + `<h1>${node.title}</h1>${renderBlocks(node.blocks)}` + renderSiblingNav(node)
}

function renderFlatItem(node) {
    const relatedTopic = topicsById[node.id]
    const related = relatedTopic
        ? `<p class="related"><a href="#topic/${relatedTopic.id}">Связанная тема: ${relatedTopic.title}</a></p>`
        : ''
    return `<h1>${node.title}</h1>${renderBlocks(node.blocks)}${related}`
}

function renderSectionRoot(sectionKey, section) {
    const links = section.list
        .map(id => section.byId[id])
        .map(item => `<li><a href="#${sectionKey}/${item.id}">${item.title}</a></li>`)
        .join('')
    return `<h1>${section.label}</h1><ul class="node-list">${links}</ul>`
}

function router() {
    const app = document.querySelector('#app')
    const hash = location.hash.slice(1)
    const [sectionKey, ...rest] = hash.split('/')
    const id = rest.join('/')

    let html

    if (!sectionKey) {
        html = renderTopNav(null) + '<h1>JS Roadmap</h1><p>Выбери раздел сверху.</p>'
    } else if (!sections[sectionKey]) {
        html = renderTopNav(null) + '<p>Раздел не найден</p>'
    } else if (!id) {
        html = renderTopNav(sectionKey) + renderSectionRoot(sectionKey, sections[sectionKey])
    } else {
        const node = sections[sectionKey].byId[id]
        if (!node) {
            html = renderTopNav(sectionKey) + '<p>Страница не найдена</p>'
        } else {
            const content = sectionKey === 'topic' ? renderTopicItem(node) : renderFlatItem(node)
            html = renderTopNav(sectionKey) + content
        }
    }

    app.innerHTML = html
    document.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el))
    window.scrollTo(0, 0)
}

window.addEventListener('hashchange', router)
router()