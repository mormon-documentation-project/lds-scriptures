const {
	mkdir,
	writeFileSync: writeFile,
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

db.prepare('SELECT * FROM volumes').all()
	.forEach((volume) => {
		volume = cleanRecord(volume, 'volume');
		const volDir = path.resolve(__dirname, 'volumes', volume.name);


		mkdir(volDir, {
			recursive: true,
		}, () => {
			writeFile(path.join(volDir, `index.json`), JSON.stringify(volume));

			db.prepare('SELECT * FROM books WHERE volume_id = ?').all(volume.id)
				.forEach((book) => {
					book = cleanRecord(book, 'book')
					const bookDir = path.join(volDir, book.name);

					mkdir(bookDir, () => {
						writeFile(path.join(bookDir, 'index.json'), JSON.stringify(book));

						db.prepare('SELECT * FROM chapters WHERE book_id = ?').all(book.id)
							.forEach((chapter) => {
								chapter = cleanRecord(chapter, 'chapter');
								
								const verses = db.prepare('SELECT * FROM verses WHERE chapter_id = ?').all(chapter.id);

								chapter.verses = verses.map(verse => {
									verse = cleanRecord(verse, 'verse');

									delete verse.chapterId;
									verse.chapter = chapter.number;

									return verse;
								});

								writeFile(path.join(bookDir, `chapter-${ chapter.number }.json`), JSON.stringify(chapter));
							});
					});
				});
		});
	});
