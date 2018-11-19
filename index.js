const {
	mkdirSync,
	writeFileSync,
} = require('fs');
const path = require('path');

const {
	camelCase,
} = require('change-case');

const Sqlite = require('better-sqlite3');
const db = new Sqlite('./lds-scriptures-sqlite3.db', {
	readonly: true,
});

function cleanRecord(obj, prefix) {
	return Object.keys(obj).reduce((newObj, key) => ({
		...newObj,
		[camelCase(key.replace(prefix + '_', '')).replace('ldsUrl', 'name')]: obj[key],
	}), {});
}

function sortKeys(obj) {
	if (typeof (obj.id) !== 'undefined') {
		delete obj.id;
	}

	return Object.keys(obj).sort()
		.reduce((newObj, key) => ({
			...newObj,
			[key]: obj[key],
		}), {});
}

function makeFile(pathname, content) {
	if (Array.isArray(pathname)) {
		pathname = path.join(...pathname);
	}

	mkdirSync(path.dirname(pathname), { recursive: true });


	if (typeof content !== 'string') {
		if (Array.isArray(content)) {
			content = content.map(sortKeys);
		} else {
			content = sortKeys(content);
		}

		content = JSON.stringify(content);
	}

	writeFileSync(pathname, content);
}

function select(table, where = null) {
	let vals = [];

	if (where !== null) {
		const keys = Object.keys(where);

		vals = Object.values(where);

		where = ` WHERE ${ keys.map(key => `${ key } = ?`).join(' AND ') }`;
	} else {
		where = '';
	}

	const query = `SELECT * FROM ${ table + where }`;

	return db.prepare(query).all(...vals)
		.map((val) => cleanRecord(val, table.replace(/s$/, '')));
}

const index = {
	volumes: [],
	books: [],
};
const rootDir = path.join(__dirname, 'json');

select('volumes').forEach((volume) => {
	index.volumes.push(volume.name);

	volume.books = [];
	volume.bookCount = 0;
	volume.chapterCount = 0;
	volume.verseCount = 0;

	const volDir = path.join(rootDir, volume.name);

	select('books', { volume_id: volume.id }).forEach((book) => {
		index.books.push(book.name);

		volume.books.push(book.name);
		volume.bookCount++;

		book.chapterCount = 0;
		book.verseCount = 0;

		const bookDir = path.join(volDir, book.name);

		select('chapters', { book_id: book.id }).forEach((chapter) => {
			volume.chapterCount++;
			book.chapterCount++;

			delete chapter.bookId;

			chapter.verseCount = 0;

			const chDir = path.join(bookDir, String(chapter.number));

			const verses = select('verses', { chapter_id: chapter.id })
				.map((verse) => {
					delete verse.chapterId;
					verse.chapter = chapter.number;

					volume.verseCount++;
					book.verseCount++;
					chapter.verseCount++;

					return verse;
				});

			makeFile([chDir, 'index.json'], chapter);
			makeFile([chDir, 'verses.json'], verses);
		});

		makeFile([bookDir, 'index.json'], book);
		// console.log(book);
	});

	makeFile([volDir, 'index.json'], volume);
	console.log(volume);
});

makeFile([rootDir, 'index.json'], index);
// console.log(index);

console.log('DONE!');
