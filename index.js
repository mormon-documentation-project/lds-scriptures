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
	if (typeof obj === 'string') {
		return obj;
	}

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

const volumes = [];
const rootDir = path.join(__dirname, 'json');

select('volumes').forEach((volume) => {
	volume.books = [];
	volume.bookCount = 0;
	volume.chapterCount = 0;
	volume.verseCount = 0;

	select('books', { volume_id: volume.id }).forEach((book) => {
		volume.books.push(book.name);
		volume.bookCount++;

		delete book.volumeId;
		book.volume = volume.name;

		book.chapterCount = 0;
		book.verseCount = 0;

		const bookDir = path.join(rootDir, book.name);

		select('chapters', { book_id: book.id }).forEach((chapter) => {
			volume.chapterCount++;
			book.chapterCount++;

			delete chapter.bookId;
			chapter.volume = volume.name;

			chapter.verseCount = 0;

			chapter.verses = select('verses', { chapter_id: chapter.id })
				.map((verse) => {
					delete verse.chapterId;

					return sortKeys(verse);
				});
			
			chapter.verseCount = chapter.verses.length;
			volume.verseCount += chapter.verseCount;
			book.verseCount += chapter.verseCount;


			makeFile([bookDir, `${ chapter.number }.json`], chapter);
		});

		makeFile([rootDir, `${ book.name }.json`], book);
		console.log(book);
	});

	volumes.push(volume);
});

makeFile([rootDir, 'volumes.json'], volumes);
console.log(volumes);

console.log('DONE!');
